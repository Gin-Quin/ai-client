import {
  GoogleGenAI,
  type GenerateContentConfig,
  type GenerateContentParameters,
} from "@google/genai";
import type {
  AiClient,
  AiClientCommonParameters,
  AskParameters,
  Message,
  Thinking,
} from "./index";
import { toJsonSchema } from "@valibot/to-json-schema";
import { parse } from "valibot";
import { handleError } from "./handleError";

export const geminiModels = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export const thinkingOnlyModels = ["gemini-2.5-pro"];

export type GeminiModel = (typeof geminiModels)[number];

export type GeminiClientParameters = AiClientCommonParameters & {
  model: GeminiModel;
};

// Helper function to prepare messages by handling systemPrompt and mapping roles
function prepareMessages(
  messages: Message[],
): Array<{ role?: string; parts: Array<{ text: string }> }> {
  return messages
    .filter((msg) => msg.role !== "system") // Gemini handles system prompt separately
    .map((msg) => {
      // Map assistant role to model for Gemini
      const role = msg.role === "assistant" ? "model" : "user";

      // Handle unsupported roles by converting them to user messages
      if (msg.role === "function" || msg.role === "tool") {
        return { role: "user" as const, parts: [{ text: msg.content }] };
      }

      return {
        role: role,
        parts: [{ text: msg.content }],
      };
    });
}

// Helper function to extract system prompt from messages or parameters
function extractSystemPrompt(
  messages: Message[],
  systemPrompt?: string,
): string | undefined {
  if (systemPrompt) return systemPrompt;

  const systemMessage = messages.find((msg) => msg.role === "system");
  return systemMessage?.content;
}

const thinkingBudgetTokens: Record<Thinking, number> = {
  off: 0,
  low: 512,
  medium: 2_048,
  high: 24_576,
};

// Helper function to create generation config
function createGenerationConfig(
  { model, instructions, thinking }: GeminiClientParameters,
  askParameters: AskParameters,
): GenerateContentConfig {
  const config: GenerateContentConfig = {};

  let reasoningEffort = askParameters.thinking ?? thinking;
  if (reasoningEffort === "off" && thinkingOnlyModels.includes(model)) {
    reasoningEffort = "low";
  }

  if (askParameters.temperature !== undefined) {
    config.temperature = askParameters.temperature;
  }
  if (askParameters.maxTokens !== undefined) {
    config.maxOutputTokens = askParameters.maxTokens;
  }
  if (
    askParameters.topP !== undefined &&
    askParameters.temperature === undefined
  ) {
    config.topP = askParameters.topP;
  }
  if (askParameters.topK !== undefined) {
    config.topK = askParameters.topK;
  }
  if (reasoningEffort !== undefined) {
    config.thinkingConfig = {
      includeThoughts: false,
      thinkingBudget: thinkingBudgetTokens[reasoningEffort],
    };
  }

  const systemInstruction = extractSystemPrompt(
    askParameters.messages ?? [],
    askParameters.instructions ?? instructions,
  );
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  return config;
}

export function createGeminiClient(
  clientParameters: GeminiClientParameters,
): AiClient {
  const genAI = new GoogleGenAI({
    apiKey: clientParameters.apiKey,
  });

  return {
    ask: async (input, askParameters = {}) => {
      try {
        const updatedParameters = {
          ...askParameters,
          messages: [
            ...(askParameters.messages ?? []),
            { role: "user" as const, content: input },
          ],
        };

        const contents = prepareMessages(updatedParameters.messages);

        const params: GenerateContentParameters = {
          model: clientParameters.model,
          contents,
          config: createGenerationConfig(clientParameters, updatedParameters),
        };

        const response = await genAI.models.generateContent(params);
        return (response.text || "").trim();
      } catch (error) {
        return handleError(error);
      }
    },

    askJson: async (input, askParameters) => {
      try {
        const updatedParameters = {
          ...askParameters,
          messages: [
            ...(askParameters.messages ?? []),
            { role: "user" as const, content: input },
          ],
        };

        const contents = prepareMessages(updatedParameters.messages);

        const params: GenerateContentParameters = {
          model: clientParameters.model,
          contents,
          config: {
            ...createGenerationConfig(clientParameters, updatedParameters),
            responseMimeType: "application/json",
            responseJsonSchema: toJsonSchema(askParameters.schema),
          },
        };

        const response = await genAI.models.generateContent(params);
        const content = response.text;

        if (!content) {
          return new Error("No response content received");
        }

        const jsonContent = content.trim();
        return parse(askParameters.schema, JSON.parse(jsonContent));
      } catch (error) {
        return handleError(error);
      }
    },

    stream: async function* (input, askParameters = {}) {
      try {
        const updatedParameters = {
          ...askParameters,
          messages: [
            ...(askParameters.messages ?? []),
            { role: "user" as const, content: input },
          ],
        };

        const contents = prepareMessages(updatedParameters.messages);

        const params: GenerateContentParameters = {
          model: clientParameters.model,
          contents,
          config: createGenerationConfig(clientParameters, updatedParameters),
        };

        const response = await genAI.models.generateContentStream(params);

        for await (const chunk of response) {
          if (chunk.text !== undefined) {
            yield chunk.text;
          }
        }
      } catch (error) {
        throw handleError(error);
      }
    },
  };
}
