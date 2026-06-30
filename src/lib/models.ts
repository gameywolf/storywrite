// Catalog of providers, the models users can pick for prose generation, and the
// (server-chosen) cheaper models used for auxiliary steps. Adding OpenAI later
// is a matter of adding an entry here + an implementation in src/lib/llm.

export interface GenerationModel {
  id: string;
  label: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  /** Models the user may choose for writing prose. */
  generationModels: GenerationModel[];
  defaultModel: string;
  /** Cheap model for per-chapter story-bible updates. */
  auxModel: string;
  /** Mid model for the whole-story review pass. */
  reviewModel: string;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    id: "anthropic",
    label: "Claude (Anthropic)",
    generationModels: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8 — recommended" },
      { id: "claude-fable-5", label: "Claude Fable 5 — premium prose" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — budget" },
    ],
    defaultModel: "claude-opus-4-8",
    auxModel: "claude-haiku-4-5",
    reviewModel: "claude-sonnet-4-6",
  },
};

export const DEFAULT_PROVIDER = "anthropic";

export function getProviderConfig(id: string): ProviderConfig {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export type TargetLengthKey = "SHORT_STORY" | "NOVELLA" | "NOVEL" | "EPIC";

export interface TargetLength {
  key: TargetLengthKey | "CUSTOM";
  label: string;
  /** Total target book length in words. The AI decides how many chapters to use
   *  and how long each should be, based on the story. */
  words: number;
}

export const TARGET_LENGTHS: Record<TargetLengthKey, TargetLength> = {
  SHORT_STORY: { key: "SHORT_STORY", label: "Short story (~7,500 words)", words: 7500 },
  NOVELLA: { key: "NOVELLA", label: "Novella (~30,000 words)", words: 30000 },
  NOVEL: { key: "NOVEL", label: "Novel (~90,000 words)", words: 90000 },
  EPIC: { key: "EPIC", label: "Epic (~150,000 words)", words: 150000 },
};

// Bounds for a user-entered custom word count.
export const MIN_CUSTOM_WORDS = 500;
export const MAX_CUSTOM_WORDS = 500000;

/**
 * Resolve a stored targetLength into a TargetLength. Accepts either a preset key
 * (e.g. "NOVEL") or a raw word count (e.g. "42000" from the "Other" option).
 * Returns null if the value is neither.
 */
export function parseTargetLength(value: string): TargetLength | null {
  const preset = TARGET_LENGTHS[value as TargetLengthKey];
  if (preset) return preset;
  const words = Number(value);
  if (Number.isInteger(words) && words >= MIN_CUSTOM_WORDS && words <= MAX_CUSTOM_WORDS) {
    return { key: "CUSTOM", label: `Custom (~${words.toLocaleString()} words)`, words };
  }
  return null;
}

export function getTargetLength(key: string): TargetLength {
  const t = parseTargetLength(key);
  if (!t) throw new Error(`Unknown target length: ${key}`);
  return t;
}
