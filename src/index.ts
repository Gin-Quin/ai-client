import { type InferOutput, type ObjectSchema } from "valibot";
import {
  createOpenAiClient,
  type OpenAiClientParameters,
  type OpenAiModel,
  openAiModels,
} from "./OpenAIClient";
import {
  createGeminiClient,
  type GeminiClientParameters,
  type GeminiModel,
  geminiModels,
} from "./GeminiClient";
import {
  createGroqClient,
  type GroqClientParameters,
  type GroqModel,
  groqModels,
} from "./GroqClient";
import {
  createClaudeClient,
  type ClaudeClientParameters,
  type ClaudeModel,
  claudeModels,
} from "./ClaudeClient";

export type AiClientProvider = "openai" | "gemini" | "groq" | "claude";

export interface AiClientCommonParameters {
  apiKey: string;
  baseUrl?: string;
  instructions?: string; // Override system message (if not in messages)
  thinking?: Thinking;
}

export interface AskParameters {
  messages?: Message[];

  //  Model behavior
  temperature?: number; // 0-2, controls randomness (0 = deterministic, 2 = very random)
  maxTokens?: number; // Maximum tokens in the response
  topP?: number; // 0-1, nucleus sampling (alternative to temperature, ignored if temperature is set)
  topK?: number; // Top-k sampling (common in open-source models)

  // Content filtering
  presencePenalty?: number; // -2 to 2, penalize new topics
  frequencyPenalty?: number; // -2 to 2, penalize repetition

  // Advanced options
  instructions?: string; // Override system message (if not in messages)
  thinking?: Thinking; // Override default thinking configuration
  user?: string; // User identifier for tracking
}

export interface AiClient {
  ask(input: string, parameters?: AskParameters): Promise<string | Error>;
  askJson<Schema extends ObjectSchema<any, any>>(
    input: string,
    parameters: AskParametersJSON<Schema>,
  ): Promise<InferOutput<Schema> | Error>;
  stream(input: string, parameters?: AskParameters): AsyncGenerator<string>;
}

export interface AskParametersJSON<Schema extends ObjectSchema<any, any>>
  extends AskParameters {
  schema: Schema;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool" | "function";
  content: string;
}

export type AiClientParameters =
  | ({ provider: "openai" } & OpenAiClientParameters)
  | ({ provider: "groq" } & GroqClientParameters)
  | ({ provider: "google" } & GeminiClientParameters)
  | ({ provider: "claude" } & ClaudeClientParameters);

export type Thinking = "off" | "low" | "medium" | "high";

export function createAiClient(parameters: AiClientParameters): AiClient {
  switch (parameters.provider) {
    case "openai":
      return createOpenAiClient(parameters);
    case "google":
      return createGeminiClient(parameters);
    case "groq":
      return createGroqClient(parameters);
    case "claude":
      return createClaudeClient(parameters);
  }
}

// Export model types and constants for convenience
export type { OpenAiModel, ClaudeModel, GeminiModel, GroqModel };
export { openAiModels, claudeModels, geminiModels, groqModels };
export {
  createOpenAiClient,
  createClaudeClient,
  createGeminiClient,
  createGroqClient,
};
