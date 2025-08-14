/**
 * This module contains functions to create and interact with Mistral clients.
 * @module
 */

import { Mistral } from "@mistralai/mistralai";
import type { SDKOptions } from "@mistralai/mistralai/lib/config";
import type { AiClient, AiClientCommonParameters, Message } from "./index";
import { toJsonSchema } from "@valibot/to-json-schema";
import { parse } from "valibot";
import { handleError } from "./handleError";

/**
 * Available Mistral model identifiers
 */
export const mistralModels = [
  "magistral-medium-latest",
  "magistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "ministral-3b-latest",
  "ministral-8b-latest",
  "open-mistral-nemo",
  "mistral-small-latest",
  "devstral-small-latest",
  "devstral-medium-latest",
  "mistral-saba-latest",
] as const;

/**
 * Union type of all available Mistral models
 */
export type MistralModel = (typeof mistralModels)[number];

/**
 * Configuration parameters for creating a Mistral client
 */
export type MistralClientParameters = SDKOptions &
  AiClientCommonParameters & {
    model: MistralModel;
  };

// Helper function to prepare messages by handling systemPrompt and mapping roles
function prepareMessages(
  messages: Message[],
  systemPrompt?: string,
): Array<{
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}> {
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
    // Map function role to tool role for Mistral
    if (msg.role === "function") {
      return { role: "tool" as const, content: msg.content };
    }
    return {
      role: msg.role as "system" | "user" | "assistant" | "tool",
      content: msg.content,
    };
  });
}

/**
 * Creates a Mistral client instance
 * @param clientParameters - Configuration parameters for the Mistral client
 * @returns An AI client instance configured for Mistral
 */
export function createMistralClient(
  clientParameters: MistralClientParameters,
): AiClient {
  const client = new Mistral({
    apiKey: clientParameters.apiKey,
    serverURL: clientParameters.baseUrl,
    timeoutMs: clientParameters.timeoutMs,
  });

  return {
    provider: "mistral",
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

        // Handle Mistral's greedy sampling requirement
        const temperature = askParameters.temperature;
        const topP = temperature === 0 ? undefined : askParameters.topP;

        const result = await client.chat.complete({
          model: clientParameters.model,
          messages: prepareMessages(
            updatedParameters.messages ?? [],
            updatedParameters.instructions ?? clientParameters.instructions,
          ),
          temperature: temperature,
          maxTokens: askParameters.maxTokens,
          topP: topP,
        });

        const content = result.choices?.[0]?.message?.content;
        if (typeof content === "string") {
          return content;
        }
        if (Array.isArray(content)) {
          // Handle ContentChunk[] by concatenating text content
          return content.map((chunk: any) => chunk.text || "").join("");
        }
        return "";
      } catch (error) {
        return handleError(error);
      }
    },

    askJson: async (input, askParameters) => {
      try {
        const jsonSchema = toJsonSchema(askParameters.schema);

        // Include schema in the prompt for Mistral
        const promptWithSchema = `${input}

You must respond with valid JSON that matches this schema:
${JSON.stringify(jsonSchema, null, 2)}

Respond ONLY with the JSON object, no additional text or markdown formatting.`;

        const updatedParameters = {
          ...askParameters,
          messages: [
            ...(askParameters.messages ?? []),
            { role: "user" as const, content: promptWithSchema },
          ],
        };

        // Handle Mistral's greedy sampling requirement
        const temperature = askParameters.temperature;
        const topP = temperature === 0 ? undefined : askParameters.topP;

        const result = await client.chat.complete({
          model: clientParameters.model,
          messages: prepareMessages(
            updatedParameters.messages ?? [],
            updatedParameters.instructions ?? clientParameters.instructions,
          ),
          temperature: temperature,
          maxTokens: askParameters.maxTokens,
          topP: topP,
          responseFormat: {
            type: "json_object" as const,
          },
        });

        const content = result.choices?.[0]?.message?.content;
        let contentStr: string;

        if (typeof content === "string") {
          contentStr = content;
        } else if (Array.isArray(content)) {
          // Handle ContentChunk[] by concatenating text content
          contentStr = content.map((chunk: any) => chunk.text || "").join("");
        } else {
          return new Error("No response content received");
        }

        if (!contentStr) {
          return new Error("No response content received");
        }

        return parse(askParameters.schema, JSON.parse(contentStr));
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

        // Handle Mistral's greedy sampling requirement
        const temperature = askParameters.temperature;
        const topP = temperature === 0 ? undefined : askParameters.topP;

        const stream = await client.chat.stream({
          model: clientParameters.model,
          messages: prepareMessages(
            updatedParameters.messages ?? [],
            updatedParameters.instructions ?? clientParameters.instructions,
          ),
          temperature: temperature,
          maxTokens: askParameters.maxTokens,
          topP: topP,
        });

        for await (const chunk of stream) {
          const content = chunk.data?.choices?.[0]?.delta?.content;
          if (typeof content === "string") {
            yield content;
          } else if (Array.isArray(content)) {
            // Handle ContentChunk[] by yielding text content
            for (const contentChunk of content) {
              if (
                contentChunk &&
                typeof contentChunk === "object" &&
                "text" in contentChunk
              ) {
                yield contentChunk.text || "";
              }
            }
          }
        }
      } catch (error) {
        throw handleError(error);
      }
    },
  };
}
