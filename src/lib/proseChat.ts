import { z } from "zod";
import { getProvider } from "./llm";
import type { ProseProposal } from "./prosePatch";
import {
  PROSE_CHAT_SYSTEM,
  buildProseChatPrompt,
  type ProseChatContext,
} from "./prompts/proseChat";

// ---- Output shape -----------------------------------------------------------
// The model returns a PATCH — only the paragraphs it is changing — plus a short
// reply and an optional blueprint instruction. The client applies the patch to
// the chapter for a before/after preview before anything is saved.

const ProseEditSchema = z.object({
  op: z.enum(["replace", "insert", "remove"]),
  paragraph: z.number().int(),
  text: z.string(),
});

const ProseProposalSchema = z.object({
  reply: z.string(),
  edits: z.array(ProseEditSchema),
  blueprintInstruction: z.string(),
});

// Strict JSON Schema (Anthropic rules: additionalProperties:false + every prop
// in `required`). "Edits-only" is expressed as an array the model leaves EMPTY
// when it is only asking a question; blueprintInstruction is "" when the plan
// needn't change.
const PROSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description:
        "A short note to the writer on what you changed, or a clarifying question if the instruction was ambiguous (in which case make no edits). One or two sentences.",
    },
    edits: {
      type: "array",
      description:
        "The changed paragraphs ONLY — never include a paragraph you are not changing; this is what saves output. Ops apply top-to-bottom; each 'paragraph' refers to the position AFTER earlier ops in this list have been applied.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          op: {
            type: "string",
            enum: ["replace", "insert", "remove"],
            description:
              "'replace' rewrites a paragraph in place; 'insert' adds a new paragraph at this position; 'remove' deletes one.",
          },
          paragraph: {
            type: "integer",
            description:
              "1-based paragraph number (matching the numbered list in the prompt). For 'insert', the position to insert at (use paragraph count + 1 to append).",
          },
          text: {
            type: "string",
            description: "The new/replacement paragraph text. Use an empty string for 'remove'.",
          },
        },
        required: ["op", "paragraph", "text"],
      },
    },
    blueprintInstruction: {
      type: "string",
      description:
        "If this prose change makes the story's plan (blueprint) inaccurate, a short self-contained instruction the plan editor can apply. Empty string when the plan needn't change.",
    },
  },
  required: ["reply", "edits", "blueprintInstruction"],
} as const;

// ---- Entry point ------------------------------------------------------------

export interface RevisePchapterInput extends ProseChatContext {
  provider: string;
  model: string;
  apiKey: string;
}

export async function revisePchapter(input: RevisePchapterInput): Promise<ProseProposal> {
  const llm = getProvider(input.provider, input.apiKey);

  const { data } = await llm.generateJSON({
    model: input.model,
    system: PROSE_CHAT_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildProseChatPrompt({
          chapterNumber: input.chapterNumber,
          chapterTitle: input.chapterTitle,
          paragraphs: input.paragraphs,
          selection: input.selection,
          history: input.history,
          instruction: input.instruction,
          blueprint: input.blueprint,
          voiceAnalysis: input.voiceAnalysis,
          voiceExcerpts: input.voiceExcerpts,
        }),
      },
    ],
    maxTokens: 8000,
    effort: "high",
    thinking: true,
    jsonSchema: PROSE_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "prose_patch",
  });

  return ProseProposalSchema.parse(data);
}
