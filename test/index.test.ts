import { test, expect } from "bun:test";
import { openAiModels } from "../library/openAi";
import { object, parse, string } from "valibot";
import {
  createAiClient,
  mistralModels,
  type AiClientParameters,
} from "../library";
import { geminiModels } from "../library/gemini";
import { groqModels } from "../library/groq";
import { claudeModels } from "../library/claude";

const testTimeout = 30_000;

const raise = (message: string) => {
  throw new Error(message);
};

const {
  GEMINI_API_KEY,
  OPENAI_API_KEY,
  GROQ_API_KEY,
  CLAUDE_API_KEY,
  MISTRAL_API_KEY,
} = process.env;

const CLIENTS_BY_PROVIDER: Array<Array<AiClientParameters>> = [
  // openAiModels.map((model) => ({
  //   provider: "openai" as const,
  //   model,
  //   apiKey: OPENAI_API_KEY ?? raise("OPENAI_API_KEY not found"),
  // })),
  // geminiModels.map((model) => ({
  //   provider: "google",
  //   model,
  //   apiKey: GEMINI_API_KEY ?? raise("GEMINI_API_KEY not found"),
  // })),
  // groqModels.map((model) => ({
  //   provider: "groq",
  //   model,
  //   apiKey: GROQ_API_KEY ?? raise("GROQ_API_KEY not found"),
  // })),
  // claudeModels.map((model) => ({
  //   provider: "claude" as const,
  //   model,
  //   apiKey: CLAUDE_API_KEY ?? raise("CLAUDE_API_KEY not found"),
  // })),
  mistralModels.map((model) => ({
    provider: "mistral" as const,
    model,
    apiKey: MISTRAL_API_KEY ?? raise("MISTRAL_API_KEY not found"),
  })),
] as const;

const schema = object({
  greeting: string(),
  language: string(),
});

// Register tests synchronously for all providers and models
for (const clientsForProvider of CLIENTS_BY_PROVIDER) {
  for (const clientParameters of clientsForProvider) {
    const { provider, model } = clientParameters;

    // Test 1: ask method
    test(
      `${provider}:${model} ask method should respond to a simple question`,
      async () => {
        const client = createAiClient(clientParameters);

        const askResponse = await client.ask(
          `Answer me with "Hello, World!" and nothing else. (DO NOT WRITE CODE, ONLY ANSWER WITH 'Hello, World!')`,
          {
            temperature: 0,
            thinking: "off",
            topK: 32,
            topP: 0.9,
            presencePenalty: 0.1,
            frequencyPenalty: 0.1,
            user: "test-user",
          },
        );

        if (askResponse instanceof Error) {
          throw askResponse;
        }

        expect(typeof askResponse).toBe("string");
        expect(askResponse?.toString()).toBeOneOf([
          "Hello, World!",
          "Hello, World!",
          "Hello, World",
          "Hello, world!",
          "Hello, world",
          "Hello world!",
          "Hello world",
        ]);
      },
      testTimeout,
    );

    // Test 2: askJson method
    test(
      `${provider}:${model} askJson method should return structured data`,
      async () => {
        const client = createAiClient(clientParameters);

        const askJsonResponse = await client.askJson(
          "Return a greeting in English with the language name",
          {
            schema,
            temperature: 0,
            topK: 1,
            topP: 1,
            thinking: "low",
            presencePenalty: 0,
            frequencyPenalty: 0,
            user: "test-user",
          },
        );

        if (askJsonResponse instanceof Error) {
          throw askJsonResponse;
        }

        expect(typeof askJsonResponse).toBe("object");
        expect(() => parse(schema, askJsonResponse)).not.toThrow();
      },
      testTimeout,
    );

    // Test 3: stream method
    test(
      `${provider}:${model} stream method should yield content chunks`,
      async () => {
        const client = createAiClient(clientParameters);
        const streamChunks: Array<string> = [];

        const stream = client.stream(
          "Output the numbers 1, 2, and 3, each on a separate line.",
          {
            temperature: 0,
            topK: 1,
            topP: 1,
            thinking: "off",
            presencePenalty: 0,
            frequencyPenalty: 0,
            user: "test-user",
          },
        );

        for await (const chunk of stream) {
          streamChunks.push(chunk);
        }

        // Test that we received chunks
        expect(streamChunks.length).toBeGreaterThan(0);

        // Test that chunks are strings
        streamChunks.forEach((chunk) => {
          expect(typeof chunk).toBe("string");
        });

        // Test the complete content contains the expected numbers
        const fullContent = streamChunks.join("");
        expect(fullContent).toMatch(/1/);
        expect(fullContent).toMatch(/2/);
        expect(fullContent).toMatch(/3/);
      },
      testTimeout,
    );
  }
}
