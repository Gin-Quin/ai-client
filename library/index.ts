/**
 * Main entry point for the AI client library providing unified access to multiple AI providers.
 * @module
 */

import { type InferOutput, type ObjectSchema } from "valibot";
import {
  createOpenAiClient,
  type OpenAiClientParameters,
  type OpenAiModel,
  openAiModels,
} from "./openAi";
import {
  createGeminiClient,
  type GeminiClientParameters,
  type GeminiModel,
  geminiModels,
} from "./gemini";
import {
  createGroqClient,
  type GroqClientParameters,
  type GroqModel,
  groqModels,
} from "./groq";
import {
  createClaudeClient,
  type ClaudeClientParameters,
  type ClaudeModel,
  claudeModels,
} from "./claude";
import {
  createMistralClient,
  type MistralClientParameters,
  type MistralModel,
  mistralModels,
} from "./mistral";

/**
 * Supported AI client providers
 */
export type AiClientProvider =
  | "openai"
  | "gemini"
  | "groq"
  | "claude"
  | "mistral";

/**
 * Common parameters shared across all AI client providers
 */
export interface AiClientCommonParameters {
  /** API key for authenticating with the AI provider */
  apiKey: string;
  /** Optional base URL for the API endpoint */
  baseUrl?: string;
  /** Override system message (if not in messages) */
  instructions?: string;
  /** Default thinking/reasoning effort level */
  thinking?: Thinking;
}

/**
 * Parameters for AI client ask operations
 */
export interface AskParameters {
  /** Array of conversation messages */
  messages?: Message[];

  //  Model behavior
  /** Controls randomness (0 = deterministic, 2 = very random) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Nucleus sampling (0-1, alternative to temperature, ignored if temperature is set) */
  topP?: number;
  /** Top-k sampling (common in open-source models) */
  topK?: number;

  // Content filtering
  /** Penalize new topics (-2 to 2) */
  presencePenalty?: number;
  /** Penalize repetition (-2 to 2) */
  frequencyPenalty?: number;

  // Advanced options
  /** Override system message (if not in messages) */
  instructions?: string;
  /** Override default thinking configuration */
  thinking?: Thinking;
  /** User identifier for tracking */
  user?: string;
}

/**
 * AI client interface providing methods for interacting with AI models
 */
export interface AiClient {
  /**
   * Provider of the AI client
   * @example "openai" | "groq" | "anthropic" | ...
   */
  provider: AiClientProvider;

  /**
   * Model identifier for the AI client
   * @example "gpt-3.5-turbo" | "gpt-4" | "llama-3.3" | ...
   */
  model: string;

  /**
   * Ask the AI model a question and get a text response
   * @param input - The input message to send to the AI
   * @param parameters - Optional parameters for the request
   * @returns Promise resolving to the AI's response or an Error
   */
  ask(input: string, parameters?: AskParameters): Promise<string | Error>;

  /**
   * Ask the AI model a question and get a structured JSON response
   * @param input - The input message to send to the AI
   * @param parameters - Parameters including the schema for JSON validation
   * @returns Promise resolving to the parsed JSON response or an Error
   */
  askJson<Schema extends ObjectSchema<any, any>>(
    input: string,
    parameters: AskParametersJSON<Schema>,
  ): Promise<InferOutput<Schema> | Error>;

  /**
   * Ask the AI model a question and get a streaming text response
   * @param input - The input message to send to the AI
   * @param parameters - Optional parameters for the request
   * @returns AsyncGenerator yielding text chunks as they arrive
   */
  stream(input: string, parameters?: AskParameters): AsyncGenerator<string>;
}

/**
 * Extended ask parameters for JSON response requests with schema validation
 */
export interface AskParametersJSON<Schema extends ObjectSchema<any, any>>
  extends AskParameters {
  /** Valibot schema for validating and parsing the JSON response */
  schema: Schema;
}

/**
 * Message structure for conversation history
 */
export interface Message {
  /** The role of the message sender (system, user, assistant, tool, or function) */
  role: "system" | "user" | "assistant" | "tool" | "function";
  /** The text content of the message */
  content: string;
}

/**
 * Union type for all AI client provider parameters
 */
export type AiClientParameters =
  | ({ provider: "openai" } & OpenAiClientParameters)
  | ({ provider: "groq" } & GroqClientParameters)
  | ({ provider: "google" } & GeminiClientParameters)
  | ({ provider: "claude" } & ClaudeClientParameters)
  | ({ provider: "mistral" } & MistralClientParameters);

/**
 * Thinking/reasoning effort levels for AI models that support it
 */
export type Thinking = "off" | "low" | "medium" | "high";

/**
 * Factory function to create an AI client based on the specified provider
 * @param parameters - Configuration parameters for the AI client provider
 * @returns An AI client instance
 */
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
    case "mistral":
      return createMistralClient(parameters);
    default:
      // This should never happen due to TypeScript exhaustiveness checking
      const _exhaustiveCheck: never = parameters;
      throw new Error(`Unknown provider: ${(parameters as any).provider}`);
  }
}

// Export model types and constants for convenience
export type { OpenAiModel, ClaudeModel, GeminiModel, GroqModel, MistralModel };
export { openAiModels, claudeModels, geminiModels, groqModels, mistralModels };
export {
  createOpenAiClient,
  createClaudeClient,
  createGeminiClient,
  createGroqClient,
  createMistralClient,
};
