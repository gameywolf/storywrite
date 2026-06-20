import Anthropic from "@anthropic-ai/sdk";
import {
  LLMError,
  type GenerateJSONOptions,
  type GenerateTextOptions,
  type LLMProvider,
  type Usage,
} from "./types";

type RawUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined;

function toUsage(u: RawUsage): Usage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  };
}

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function fail(e: unknown): never {
  if (e instanceof LLMError) throw e;
  if (e instanceof Anthropic.APIError) {
    const status = e.status ?? 500;
    let message = e.message;
    if (status === 401) message = "Invalid Anthropic API key.";
    else if (status === 403) message = "This API key is not permitted to use the requested model.";
    else if (status === 429) message = "Rate limited by Anthropic — try again shortly.";
    throw new LLMError(message, status);
  }
  throw new LLMError(e instanceof Error ? e.message : "Unknown LLM error", 500);
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(opts: GenerateTextOptions) {
    try {
      const res = await this.client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 16000,
        messages: opts.messages,
        ...(opts.system ? { system: opts.system } : {}),
        ...(opts.thinking ? { thinking: { type: "adaptive" } } : {}),
        ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
      });
      if (res.stop_reason === "refusal") {
        throw new LLMError("The model declined to complete this request.", 422);
      }
      return { text: textOf(res.content), usage: toUsage(res.usage) };
    } catch (e) {
      fail(e);
    }
  }

  async generateJSON(opts: GenerateJSONOptions) {
    try {
      const res = await this.client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 16000,
        messages: opts.messages,
        ...(opts.system ? { system: opts.system } : {}),
        ...(opts.thinking ? { thinking: { type: "adaptive" } } : {}),
        output_config: {
          format: { type: "json_schema", schema: opts.jsonSchema },
          ...(opts.effort ? { effort: opts.effort } : {}),
        },
      });
      if (res.stop_reason === "refusal") {
        throw new LLMError("The model declined to complete this request.", 422);
      }
      const raw = textOf(res.content);
      if (!raw) {
        throw new LLMError(
          `Model returned no output (stop reason: ${res.stop_reason ?? "unknown"}).`,
          502,
        );
      }
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new LLMError("Model returned malformed JSON.", 502);
      }
      return { data, raw, usage: toUsage(res.usage) };
    } catch (e) {
      fail(e);
    }
  }
}
