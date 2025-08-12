import { type InferOutput, type ObjectSchema } from "valibot";
import {
  createOpenAiClient,
  type OpenAiClientParameters,
} from "./OpenAIClient";
import {
  createGeminiClient,
  type GeminiClientParameters,
} from "./GeminiClient";
import { createGroqClient, type GroqClientParameters } from "./GroqClient";

export type AiClientProvider = "openai" | "gemini" | "groq";

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
  topP?: number; // 0-1, nucleus sampling (alternative to temperature)
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
  | ({ provider: "google" } & GeminiClientParameters);

export type Thinking = "off" | "low" | "medium" | "high";

export function createAiClient(parameters: AiClientParameters): AiClient {
  switch (parameters.provider) {
    case "openai":
      return createOpenAiClient(parameters);
    case "google":
      return createGeminiClient(parameters);
    case "groq":
      return createGroqClient(parameters);
  }
}
