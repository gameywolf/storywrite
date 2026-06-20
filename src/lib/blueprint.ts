import { z } from "zod";
import { getProvider } from "./llm";
import { getTargetLength, type TargetLength } from "./models";

// ---- Output shape -----------------------------------------------------------

const CharacterSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string(),
});

const ChapterPlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  outline: z.string(),
});

export const BlueprintSchema = z.object({
  title: z.string(),
  logline: z.string(),
  inferred: z.object({
    genre: z.string(),
    pov: z.string(),
    tense: z.string(),
    tone: z.string(),
    setting: z.string(),
    mainCharacters: z.array(CharacterSchema),
  }),
  chapters: z.array(ChapterPlanSchema),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

// Hand-written JSON Schema (satisfies Anthropic's strict-output rules: every
// object has additionalProperties:false and lists all props in `required`).
// Kept in lockstep with BlueprintSchema above.
const BLUEPRINT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A working title for the book." },
    logline: { type: "string", description: "One-sentence summary of the story." },
    inferred: {
      type: "object",
      additionalProperties: false,
      properties: {
        genre: { type: "string" },
        pov: { type: "string", description: 'e.g. "First person", "Third person limited"' },
        tense: { type: "string", description: 'e.g. "Past", "Present"' },
        tone: { type: "string" },
        setting: { type: "string" },
        mainCharacters: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              role: { type: "string", description: "e.g. protagonist, antagonist, love interest" },
              description: { type: "string" },
            },
            required: ["name", "role", "description"],
          },
        },
      },
      required: ["genre", "pov", "tense", "tone", "setting", "mainCharacters"],
    },
    chapters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "One or two sentence summary of the chapter." },
          outline: {
            type: "string",
            description:
              "A detailed, beat-by-beat paragraph of what happens: character goals, conflicts, key events, and how it advances the overall arc.",
          },
        },
        required: ["title", "description", "outline"],
      },
    },
  },
  required: ["title", "logline", "inferred", "chapters"],
} as const;

// ---- Prompts ----------------------------------------------------------------

const SYSTEM = `You are a master story architect and developmental editor. Given a writer's idea, you design a clear, compelling, chapter-by-chapter blueprint for their book.

Principles:
- Honor everything the writer specified. Sensibly invent what they left blank, staying true to the spirit and genre of their idea.
- Infer genre, point of view, tense, tone, setting, and the main characters from their description. If they stated any of these explicitly, use theirs exactly.
- Give every chapter a title, a one-to-two sentence description, and a DETAILED outline — a beat-by-beat paragraph covering character goals, the central conflict of the chapter, the key events, and how it moves the overall story forward.
- Build a genuine dramatic arc across the chapters: setup, rising action, a midpoint turn, escalating stakes, a climax, and a resolution. Avoid repetitive or filler chapters.
- Plan only. Do NOT write any prose for the chapters themselves.`;

function userPrompt(description: string, len: TargetLength): string {
  return `Here is my story idea:

"""
${description}
"""

Plan a ${len.label} of exactly ${len.chapters} chapters, each intended to run roughly ${len.wordsPerChapter} words. Produce a working title and a one-sentence logline, infer the story's genre/POV/tense/tone/setting and main characters, then outline every chapter in detail.`;
}

// ---- Entry point ------------------------------------------------------------

export interface GenerateBlueprintInput {
  description: string;
  targetLength: string;
  provider: string;
  model: string;
  apiKey: string;
}

export async function generateBlueprint(input: GenerateBlueprintInput): Promise<Blueprint> {
  const len = getTargetLength(input.targetLength);
  const llm = getProvider(input.provider, input.apiKey);

  const { data } = await llm.generateJSON({
    model: input.model,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(input.description, len) }],
    maxTokens: 16000,
    effort: "high",
    thinking: true,
    jsonSchema: BLUEPRINT_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "blueprint",
  });

  return BlueprintSchema.parse(data);
}
