# @gin-quin/ai-client

A simple, universal, and easy-to-use AI client that provides a unified interface for OpenAI, Groq, Claude, and Gemini AI providers. This library is designed to make AI integration effortless while being highly compliant and forgiving - it gracefully handles provider differences and ignores unsupported features rather than throwing errors.

## Features

- **Universal Interface**: Same API works across all providers (OpenAI, Groq, Claude, Gemini)
- **Highly Compliant**: Gracefully handles provider differences - unsupported features are ignored rather than causing errors
- **TypeScript First**: Full type safety with intelligent auto-completion
- **Streaming Support**: Real-time response streaming for all providers
- **JSON Schema Support**: Structured output with validation using Valibot (required - not compatible with other validation libraries)
- **Tree-shakable**: Import only what you need to minimize bundle size


## Supported Models

These models have been tested and can run interchangeably with `ai-client`:

### Claude
- `claude-sonnet-4-0`
- `claude-opus-4-1`
- `claude-3-5-haiku-latest`

## Mistral
- `magistral-medium-latest`
- `magistral-small-latest`
- `mistral-medium-latest`
- `mistral-large-latest`
- `ministral-3b-latest`
- `ministral-8b-latest`
- `open-mistral-nemo`
- `mistral-small-latest`
- `devstral-small-latest`
- `devstral-medium-latest`
- `mistral-saba-latest`

### OpenAI
- `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`
- `gpt-5`, `gpt-5-mini`, `gpt-5-nano`
- `o3`, `o3-mini`, `o4-mini`


### Groq
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `openai/gpt-oss-20b`
- `openai/gpt-oss-120b`
- `moonshotai/kimi-k2-instruct`
- `meta-llama/llama-4-maverick-17b-128e-instruct`
- `meta-llama/llama-4-scout-17b-16e-instruct`
- `deepseek-r1-distill-llama-70b`
- `qwen/qwen3-32b`

### Gemini
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`

## Installation

```bash
# Install from JSR
bunx jsr add @gin-quin/ai-client

# Install from NPM
bun add @gin-quin/ai-client
```

**Note**: This library requires Valibot for JSON schema validation. It is not compatible with other validation libraries like Zod or Joi.

## Quick Start

### Option 1: Generic Client (Great for Prototyping)

Use the generic `createAiClient` function to quickly test different providers:

```ts
import { createAiClient } from "@gin-quin/ai-client";

const ai = createAiClient({
  provider: "openai",
  model: "gpt-4.1",
  apiKey: process.env.OPENAI_API_KEY!,
});

const response = await ai.ask("What is the capital of France?");
console.log(response); // "The capital of France is Paris."
```

### Option 2: Specific Client (Production Ready)

Import specific clients to avoid bundling unnecessary SDKs:

```ts
import { createOpenAiClient } from "@gin-quin/ai-client/openAi";

const ai = createOpenAiClient({
  model: "gpt-4.1",
  apiKey: process.env.OPENAI_API_KEY!,
});
```

## Usage Examples

### Basic Text Generation

```ts
import { createAiClient } from "@gin-quin/ai-client";

const ai = createAiClient({
  provider: "claude",
  model: "claude-sonnet-4-0",
  apiKey: process.env.CLAUDE_API_KEY!,
  instructions: "You are a helpful assistant.",
});

// Simple question
const answer = await ai.ask("Explain quantum computing in simple terms");
console.log(answer);

// With parameters
const response = await ai.ask("Write a haiku about programming", {
  temperature: 0.8,
  maxTokens: 100,
  thinking: "medium", // Only works with thinking models - ignored for other ones
});
```

### Structured JSON Output

This library uses **Valibot** for schema validation and is not compatible with other validation libraries like Zod.

```ts
import { createAiClient } from "@gin-quin/ai-client";
import { object, string, number } from "valibot";

const ai = createAiClient({
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  apiKey: process.env.GROQ_API_KEY!,
});

// Must use Valibot schema - not compatible with Zod or other validators
const schema = object({
  name: string(),
  age: number(),
  occupation: string(),
});

const result = await ai.askJson("Create a profile for a fictional character", {
  schema,
  temperature: 0.7,
});

if (result instanceof Error) {
  console.error("Error:", result.message);
} else {
  console.log(result); // { name: "Alice", age: 28, occupation: "Software Engineer" }
}
```

### Streaming Responses

```ts
import { createAiClient } from "@gin-quin/ai-client";

const ai = createAiClient({
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY!,
});

const stream = ai.stream("Tell me a short story about a robot");

for await (const chunk of stream) {
  process.stdout.write(chunk); // Stream text as it's generated
}
```

### Conversation with Message History

Use the `messages` parameter to maintain conversation context:

```ts
import { createAiClient } from "@gin-quin/ai-client";

const ai = createAiClient({
  provider: "openai",
  model: "gpt-4.1",
  apiKey: process.env.OPENAI_API_KEY!,
});

// Build conversation history
const conversationHistory = [
  { role: "system", content: "You are a helpful coding assistant." },
  { role: "user", content: "How do I create a React component?" },
  { role: "assistant", content: "You can create a React component using function syntax..." },
  { role: "user", content: "What about with TypeScript?" },
  { role: "assistant", content: "For TypeScript, you'd add type annotations..." },
];

// Continue the conversation
const response = await ai.ask("Can you show me an example?", {
  messages: conversationHistory,
  temperature: 0.3,
});

// The AI will respond with context from the entire conversation
console.log(response);

// You can also build conversations dynamically
const messages = [];
messages.push({ role: "system", content: "You are a travel advisor." });
messages.push({ role: "user", content: "I want to visit Japan." });

const advice = await ai.ask("What's the best time to visit?", {
  messages,
  maxTokens: 200,
});
```

## Provider-Specific Examples

### OpenAI with Thinking Models

```ts
import { createOpenAiClient } from "@gin-quin/ai-client/openAi";

const ai = createOpenAiClient({
  model: "o3-mini", // Supports thinking
  apiKey: process.env.OPENAI_API_KEY!,
  thinking: "high", // Enable reasoning
});

const response = await ai.ask("Solve this complex math problem step by step: ...");
```

### Claude with Custom Instructions

```ts
import { createClaudeClient } from "@gin-quin/ai-client/claude";

const ai = createClaudeClient({
  model: "claude-sonnet-4-0",
  apiKey: process.env.CLAUDE_API_KEY!,
  instructions: "You are an expert code reviewer. Be thorough but constructive.",
});
```

### Groq for Fast Inference

```ts
import { createGroqClient } from "@gin-quin/ai-client/groq";

const ai = createGroqClient({
  model: "llama-3.3-70b-versatile",
  apiKey: process.env.GROQ_API_KEY!,
});
```

### Gemini with Advanced Parameters

```ts
import { createGeminiClient } from "@gin-quin/ai-client/gemini";

const ai = createGeminiClient({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY!,
});

const response = await ai.ask("Analyze this data", {
  temperature: 0.1,
  topK: 40,
  topP: 0.95,
});
```

## API Reference

### Client Creation

#### Generic Client
```ts
createAiClient(parameters: AiClientParameters): AiClient
```

#### Specific Clients
```ts
createOpenAiClient(parameters: OpenAiClientParameters): AiClient
createClaudeClient(parameters: ClaudeClientParameters): AiClient
createGeminiClient(parameters: GeminiClientParameters): AiClient
createGroqClient(parameters: GroqClientParameters): AiClient
```

### AiClient Methods

#### `ask(input: string, parameters?: AskParameters): Promise<string | Error>`
Generate a text response from the AI.

#### `askJson<Schema>(input: string, parameters: AskParametersJSON<Schema>): Promise<InferOutput<Schema> | Error>`
Generate structured JSON output validated against a **Valibot schema**. This library only supports Valibot - it is not compatible with Zod, Joi, or other validation libraries.

#### `stream(input: string, parameters?: AskParameters): AsyncGenerator<string>`
Stream the AI response in real-time chunks.

### Common Parameters

```ts
interface AskParameters {
  messages?: Message[];           // Conversation history
  temperature?: number;           // 0-2, controls randomness
  maxTokens?: number;            // Maximum response length
  topP?: number;                 // 0-1, nucleus sampling
  topK?: number;                 // Top-k sampling
  presencePenalty?: number;      // -2 to 2, penalize new topics
  frequencyPenalty?: number;     // -2 to 2, penalize repetition
  instructions?: string;         // System message override
  thinking?: "off" | "low" | "medium" | "high"; // Reasoning level
  user?: string;                 // User identifier
}
```

## Graceful Error Handling

The library is designed to be "compliant" and forgiving:

```ts
// This works even though llama-3.3 doesn't support thinking
const groqAi = createGroqClient({
  model: "llama-3.3-70b-versatile",
  apiKey: process.env.GROQ_API_KEY!,
});

// The 'thinking' parameter will be silently ignored instead of throwing
const response = await groqAi.ask("Hello", {
  thinking: "high", // Ignored gracefully
  temperature: 0.5, // This works
});
```

## License

MIT
