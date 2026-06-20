import { AnthropicProvider } from "./anthropic";
import { ClaudeCliProvider } from "./claude-cli";
import { MockProvider } from "./mock";
import { LLMError, type LLMProvider } from "./types";

/**
 * Resolve a provider implementation by name. The API key is supplied per-request
 * (from the browser) and never persisted. `mock` and `claude-cli` ignore the key.
 *
 * To add OpenAI later: implement OpenAIProvider in ./openai.ts and add a case here.
 */
export function getProvider(name: string, apiKey: string): LLMProvider {
  switch (name) {
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "mock":
      return new MockProvider();
    case "claude-cli":
      return new ClaudeCliProvider();
    // case "openai":
    //   return new OpenAIProvider(apiKey);
    default:
      throw new LLMError(`Unknown provider: ${name}`, 400);
  }
}

export type DevBackend = "mock" | "cli";

/**
 * Dev-only override (set via NEXT_PUBLIC_LLM_BACKEND). When set, generation is
 * routed through the mock provider or the local `claude` CLI instead of the
 * metered API — for cheap local testing. Returns null in normal (API) mode.
 */
export function devBackend(): DevBackend | null {
  const b = process.env.NEXT_PUBLIC_LLM_BACKEND?.toLowerCase();
  return b === "mock" || b === "cli" ? b : null;
}

/** Map the dev backend to a provider name, or fall through to the requested one. */
export function backendProviderName(requested: string): string {
  const b = devBackend();
  if (b === "mock") return "mock";
  if (b === "cli") return "claude-cli";
  return requested;
}

export * from "./types";
