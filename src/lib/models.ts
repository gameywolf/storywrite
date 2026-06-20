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
  key: TargetLengthKey;
  label: string;
  chapters: number;
  wordsPerChapter: number;
}

export const TARGET_LENGTHS: Record<TargetLengthKey, TargetLength> = {
  SHORT_STORY: { key: "SHORT_STORY", label: "Short story (~7,500 words)", chapters: 3, wordsPerChapter: 2500 },
  NOVELLA: { key: "NOVELLA", label: "Novella (~30,000 words)", chapters: 12, wordsPerChapter: 2500 },
  NOVEL: { key: "NOVEL", label: "Novel (~90,000 words)", chapters: 30, wordsPerChapter: 3000 },
  EPIC: { key: "EPIC", label: "Epic (~150,000 words)", chapters: 45, wordsPerChapter: 3300 },
};

export function getTargetLength(key: string): TargetLength {
  const t = TARGET_LENGTHS[key as TargetLengthKey];
  if (!t) throw new Error(`Unknown target length: ${key}`);
  return t;
}
