// Provider-agnostic LLM interface. The whole generation pipeline talks to this,
// so swapping Claude <-> OpenAI (or adding a provider) is a single new file.

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface GenerateTextOptions {
  model: string;
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  effort?: Effort;
  /** Enable adaptive thinking. */
  thinking?: boolean;
}

export interface GenerateJSONOptions extends GenerateTextOptions {
  /** JSON Schema constraining the output (must satisfy the provider's strict-output rules). */
  jsonSchema: Record<string, unknown>;
  schemaName: string;
}

export interface LLMProvider {
  readonly name: string;
  generateText(opts: GenerateTextOptions): Promise<{ text: string; usage: Usage }>;
  /** Returns parsed JSON validated by the provider against `jsonSchema`. Caller should still validate the shape. */
  generateJSON(opts: GenerateJSONOptions): Promise<{ data: unknown; raw: string; usage: Usage }>;
}

/** Normalized error with an HTTP-ish status so API routes can pass it through. */
export class LLMError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "LLMError";
    this.status = status;
  }
}
