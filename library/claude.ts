/**
 * This module contains functions to create and interact with Claude clients.
 * @module
 */

import {
  Anthropic,
  type ClientOptions as AnthropicClientOptions,
} from "@anthropic-ai/sdk";
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
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
} from "@anthropic-ai/sdk/resources/messages.js";

/**
 * Available Claude model identifiers
 */
export const claudeModels = [
  "claude-sonnet-4-0",
  "claude-opus-4-1",
  "claude-3-5-haiku-latest",
] as const;

/**
 * Union type of all available Claude models
 */
export type ClaudeModel = (typeof claudeModels)[number];

/**
 * Configuration parameters for creating a Claude client
 */
export type ClaudeClientParameters = AnthropicClientOptions &
  AiClientCommonParameters & {
    model: ClaudeModel;
  };

// Helper function to prepare messages by handling systemPrompt and mapping roles
function prepareMessages(
  messages: Message[],
  systemPrompt?: string,
): {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  let preparedMessages = messages;
  let systemMessage: string | undefined;

  // Extract system message from messages or use systemPrompt
  const systemIndex = messages.findIndex((msg) => msg.role === "system");
  if (systemIndex !== -1) {
    systemMessage = messages[systemIndex]?.content;
    preparedMessages = messages.filter((_, index) => index !== systemIndex);
  } else if (systemPrompt) {
    systemMessage = systemPrompt;
  }

  // Map messages and handle unsupported roles
  const mappedMessages = preparedMessages.map((msg) => {
    // Convert unsupported roles to user messages
    if (
      msg.role === "function" ||
      msg.role === "tool" ||
      msg.role === "system"
    ) {
      return { role: "user" as const, content: msg.content };
    }
    return {
      role: msg.role as "user" | "assistant",
      content: msg.content,
    };
  });

  return {
    system: systemMessage,
    messages: mappedMessages,
  };
}

// Helper function to create base completion parameters
function createBaseCompletionParams(
  { model, instructions }: ClaudeClientParameters,
  askParameters: AskParameters,
): MessageCreateParamsNonStreaming | MessageCreateParamsStreaming {
  const { system, messages } = prepareMessages(
    askParameters.messages ?? [],
    askParameters.instructions ?? instructions,
  );

  return {
    model,
    system,
    messages,
    temperature: askParameters.temperature,
    max_tokens: askParameters.maxTokens ?? 4096,
    top_p:
      askParameters.temperature !== undefined ? undefined : askParameters.topP,
    top_k: askParameters.topK,
  };
}

/**
 * Creates a Claude client instance
 * @param clientParameters - Configuration parameters for the Claude client
 * @returns An AI client instance configured for Claude
 */
export function createClaudeClient(
  clientParameters: ClaudeClientParameters,
): AiClient {
  const client = new Anthropic(clientParameters);

  return {
    provider: "claude",
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

        const completion = await client.messages.create({
          ...createBaseCompletionParams(clientParameters, updatedParameters),
          stream: false,
        });

        const content = completion.content?.[0];
        if (content && content.type === "text") {
          return content.text;
        }
        return "";
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

        const { system, messages } = prepareMessages(
          updatedParameters.messages ?? [],
          updatedParameters.instructions ?? clientParameters.instructions,
        );

        // Claude doesn't have native JSON mode like OpenAI, so we use tool calling
        // to enforce structured output. We define a tool with the desired schema
        // and force Claude to call it with the right parameters.
        const completion = await client.messages.create({
          ...createBaseCompletionParams(clientParameters, updatedParameters),
          system,
          messages,
          tools: [
            {
              name: "json_response",
              description: "Respond with structured JSON data",
              input_schema: toJsonSchema(askParameters.schema) as any,
            },
          ],
          tool_choice: { type: "tool", name: "json_response" },
          stream: false,
        });

        const content = completion.content?.[0];
        if (!content || content.type !== "tool_use") {
          return new Error("No tool use response received");
        }

        return parse(askParameters.schema, content.input);
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

        const stream = await client.messages.create({
          ...createBaseCompletionParams(clientParameters, updatedParameters),
          stream: true,
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            yield chunk.delta.text;
          }
        }
      } catch (error) {
        throw handleError(error);
      }
    },
  };
}
