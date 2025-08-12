import Groq from "groq-sdk";
import type {
  AiClient,
  AiClientCommonParameters,
  AskParameters,
  Message,
  Thinking,
} from "./index";
import { parse } from "valibot";
import { handleError } from "./handleError";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "groq-sdk/resources/chat/completions.mjs";
import { toJsonSchema } from "@valibot/to-json-schema";

export const groqModels = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "deepseek-r1-distill-llama-70b",
  "qwen/qwen3-32b",
] as const;

export const modelsSupportingStructuredOutputs = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

export const getReasoningEffortByModel: Record<
  GroqModel,
  (
    value: Thinking,
  ) => ChatCompletionCreateParamsNonStreaming["reasoning_effort"]
> = {
  "llama-3.3-70b-versatile": () => undefined,
  "llama-3.1-8b-instant": () => undefined,
  "openai/gpt-oss-20b": (value) => (value == "off" ? "low" : value),
  "openai/gpt-oss-120b": (value) => (value == "off" ? "low" : value),
  "moonshotai/kimi-k2-instruct": () => undefined,
  "meta-llama/llama-4-maverick-17b-128e-instruct": () => undefined,
  "meta-llama/llama-4-scout-17b-16e-instruct": () => undefined,
  "deepseek-r1-distill-llama-70b": () => undefined,
  "qwen/qwen3-32b": (value) => (value == "off" ? "none" : "default"),
};

export type GroqModel = (typeof groqModels)[number];

export type GroqClientParameters = AiClientCommonParameters & {
  model: GroqModel;
};

// Helper function to prepare messages by handling systemPrompt and mapping roles
function prepareMessages(
  askParameters: AskParameters,
  systemPrompt?: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const { messages } = askParameters;
  let preparedMessages = messages;

  // Handle systemPrompt by adding it to messages if provided
  if (systemPrompt) {
    const hasSystemMessage = messages?.some((msg) => msg.role === "system");
    if (!hasSystemMessage) {
      preparedMessages = [
        { role: "system", content: systemPrompt },
        ...(messages ?? []),
      ];
    } else {
      // If there's already a system message, append to it
      preparedMessages = preparedMessages?.map((msg) =>
        msg.role === "system"
          ? { ...msg, content: `${msg.content}\n\n${systemPrompt}` }
          : msg,
      );
    }
  }

  // Map messages and handle unsupported roles
  return (
    preparedMessages?.map((msg) => {
      // Only map supported Groq message roles
      if (msg.role === "function" || msg.role === "tool") {
        // Convert unsupported roles to user messages
        return { role: "user" as const, content: msg.content };
      }
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    }) ?? []
  );
}

// Helper function to create base completion parameters
function createBaseCompletionParams(
  clientParameters: GroqClientParameters,
  askParameters: AskParameters,
):
  | ChatCompletionCreateParamsNonStreaming
  | ChatCompletionCreateParamsStreaming {
  const instructions =
    askParameters.instructions ?? clientParameters.instructions;
  const { model } = clientParameters;
  const thinking = askParameters.thinking ?? clientParameters.thinking;
  const reasoningEffort =
    thinking && getReasoningEffortByModel[model](thinking);

  return {
    model,
    messages: prepareMessages(askParameters, instructions),
    temperature: askParameters.temperature,
    max_tokens: askParameters.maxTokens,
    top_p: askParameters.temperature ? undefined : askParameters.topP,
    presence_penalty: askParameters.presencePenalty,
    frequency_penalty: askParameters.frequencyPenalty,
    user: askParameters.user,
    reasoning_effort: reasoningEffort,
    include_reasoning: reasoningEffort ? false : undefined,
  };
}

export function createGroqClient(
  clientParameters: GroqClientParameters,
): AiClient {
  const client = new Groq({
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

        const completion = await client.chat.completions.create({
          ...createBaseCompletionParams(clientParameters, updatedParameters),
          stream: false,
        });

        const content = stripThinking(completion.choices[0]?.message?.content);
        return content || "";
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

        const { model } = clientParameters;
        const { schema } = askParameters;

        const supportsStructuredOutputs =
          modelsSupportingStructuredOutputs.includes(model);

        const responseFormat: ChatCompletionCreateParamsNonStreaming["response_format"] =
          supportsStructuredOutputs
            ? {
                type: "json_schema",
                json_schema: {
                  name: "response",
                  schema: toJsonSchema(schema) as Record<string, any>,
                },
              }
            : {
                type: "json_object",
              };

        // For json_object format, add JSON instructions to system prompt
        let baseParams = createBaseCompletionParams(
          clientParameters,
          updatedParameters,
        );
        if (!supportsStructuredOutputs) {
          const jsonSchema = JSON.stringify(toJsonSchema(schema), null, 2);
          const jsonInstructions = `Answer with JSON only. Follow this exact schema:\n\n${jsonSchema}`;

          const instructions =
            updatedParameters.instructions ?? clientParameters.instructions;
          const combinedInstructions = instructions
            ? `${instructions}\n\n${jsonInstructions}`
            : jsonInstructions;

          baseParams = {
            ...baseParams,
            messages: prepareMessages(updatedParameters, combinedInstructions),
          };
        }

        const completion = await client.chat.completions.create({
          ...baseParams,
          stream: false,
          response_format: responseFormat,
        });

        const content = stripThinking(completion.choices[0]?.message?.content);
        if (!content) {
          return new Error("No response content received");
        }

        return parse(askParameters.schema, JSON.parse(content));
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

        const stream = await client.chat.completions.create({
          ...createBaseCompletionParams(clientParameters, updatedParameters),
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      } catch (error) {
        throw handleError(error);
      }
    },
  };
}

function stripThinking(
  value: string | null | undefined,
): string | null | undefined {
  if (value == null) {
    return value;
  }
  if (value.startsWith("<think>")) {
    const stopThinkingAt = value.lastIndexOf("</think>") + "</think>".length;
    return value.slice(stopThinkingAt).trimStart();
  }
  return value;
}
