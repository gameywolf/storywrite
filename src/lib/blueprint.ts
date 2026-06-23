import { z } from "zod";
import { getProvider } from "./llm";
import { getTargetLength } from "./models";
import { BLUEPRINT_SYSTEM, blueprintUserPrompt } from "./prompts/blueprint";

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

// Prompts live in ./prompts/blueprint.ts (edit them there).

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
    system: BLUEPRINT_SYSTEM,
    messages: [{ role: "user", content: blueprintUserPrompt(input.description, len) }],
    maxTokens: 16000,
    effort: "high",
    thinking: true,
    jsonSchema: BLUEPRINT_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "blueprint",
  });

  return BlueprintSchema.parse(data);
}
