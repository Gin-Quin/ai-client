/**
 * This module contains functions to create and interact with OpenAI clients.
 * @module
 */

import { OpenAI, type ClientOptions as OpenAiClientOptions } from "openai";
import type {
  AiClient,
  AiClientCommonParameters,
  AskParameters,
  Message,
} from "./index";
import { toJsonSchema } from "@valibot/to-json-schema";
import { parse } from "valibot";
import { handleError } from "./handleError";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources.js";

/**
 * Available OpenAI model identifiers
 */
export const openAiModels = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "o3",
  "o3-mini",
  "o4-mini",
] as const;

// Some models (gpt-5*, o3*, o4*) don't support temperature=0, only default (1)
const modelsWithTemperatureRestrictions = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "o3",
  "o3-mini",
  "o4-mini",
];

const thinkingModels = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "o3",
  "o3-mini",
  "o4-mini",
];

/**
 * Union type of all available OpenAI models
 */
export type OpenAiModel = (typeof openAiModels)[number];

/**
 * Configuration parameters for creating an OpenAI client
 */
export type OpenAiClientParameters = OpenAiClientOptions &
  AiClientCommonParameters & {
    model: OpenAiModel;
  };

// Helper function to prepare messages by handling systemPrompt and mapping roles
function prepareMessages(
  messages: Message[],
  systemPrompt?: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  let preparedMessages = messages;

  // Handle systemPrompt by adding it to messages if provided
  if (systemPrompt) {
    const hasSystemMessage = messages.some((msg) => msg.role === "system");
    if (!hasSystemMessage) {
      preparedMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];
    }
  }

  // Map messages and handle unsupported roles
  return preparedMessages.map((msg) => {
    // Only map supported OpenAI message roles
    if (msg.role === "function" || msg.role === "tool") {
      // Convert unsupported roles to user messages
      return { role: "user" as const, content: msg.content };
    }
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    };
  });
}

// Helper function to create base completion parameters
function createBaseCompletionParams(
  { model, instructions, thinking }: OpenAiClientParameters,
  askParameters: AskParameters,
):
  | ChatCompletionCreateParamsNonStreaming
  | ChatCompletionCreateParamsStreaming {
  const hasTemperatureRestriction =
    modelsWithTemperatureRestrictions.includes(model);
  const isThinkingModel = thinkingModels.includes(model);
  const reasoningEffort = askParameters.thinking ?? thinking;

  return {
    model,
    messages: prepareMessages(
      askParameters.messages ?? [],
      askParameters.instructions ?? instructions,
    ),
    reasoning_effort: !isThinkingModel
      ? undefined
      : reasoningEffort === "off"
        ? "low"
        : reasoningEffort,
    temperature: hasTemperatureRestriction
      ? undefined
      : askParameters.temperature,
    max_completion_tokens: askParameters.maxTokens,
    top_p:
      hasTemperatureRestriction || askParameters.temperature !== undefined
        ? undefined
        : askParameters.topP,
    presence_penalty: hasTemperatureRestriction
      ? undefined
      : askParameters.presencePenalty,
    frequency_penalty: hasTemperatureRestriction
      ? undefined
      : askParameters.frequencyPenalty,
    user: askParameters.user,
  };
}

/**
 * Creates an OpenAI client instance
 * @param clientParameters - Configuration parameters for the OpenAI client
 * @returns An AI client instance configured for OpenAI
 */
export function createOpenAiClient(
  clientParameters: OpenAiClientParameters,
): AiClient {
  const client = new OpenAI(clientParameters);

  return {
    provider: "openai",
    model: clientParameters.model,

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

        const content = completion.choices[0]?.message?.content;
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

        const completion = await client.chat.completions.create({
          ...createBaseCompletionParams(clientParameters, updatedParameters),
          stream: false,
          response_format: {
            type: "json_schema" as const,
            json_schema: {
              name: "response",
              schema: toJsonSchema(askParameters.schema) as any,
            },
          },
        });

        const content = completion.choices[0]?.message?.content;
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
