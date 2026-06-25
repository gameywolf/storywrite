import { z } from "zod";
import { getProvider } from "./llm";
import { BlueprintSchema, type Blueprint } from "./blueprint";
import {
  BLUEPRINT_CHAT_SYSTEM,
  buildBlueprintChatPrompt,
  type ChatTurn,
} from "./prompts/blueprintChat";

// ---- Output shape -----------------------------------------------------------
// To save output tokens the model returns a PATCH — only the fields and chapters
// it is changing — not the whole blueprint. We apply that patch to the saved
// blueprint server-side. Chapter outlines are the bulk of the tokens, so the big
// win is that unchanged chapters are never re-emitted.

const FieldEditSchema = z.object({
  field: z.enum(["title", "logline", "genre", "pov", "tense", "tone", "setting"]),
  value: z.string(),
});

const CharacterEditSchema = z.object({
  op: z.enum(["add", "update", "remove"]),
  number: z.number().int(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
});

const ChapterEditSchema = z.object({
  op: z.enum(["update", "add", "remove", "move"]),
  number: z.number().int(),
  toNumber: z.number().int(),
  title: z.string(),
  description: z.string(),
  outline: z.string(),
});

const PatchSchema = z.object({
  reply: z.string(),
  fields: z.array(FieldEditSchema),
  characters: z.array(CharacterEditSchema),
  chapters: z.array(ChapterEditSchema),
});

export type BlueprintPatch = z.infer<typeof PatchSchema>;

// Strict JSON Schema (Anthropic rules: additionalProperties:false + every prop in
// `required`). Because optional props aren't allowed, "edits-only" is expressed
// as arrays the model leaves EMPTY when nothing changes, and an empty-string =
// "leave this field as it was" convention on updates. The field descriptions do
// the heavy lifting of teaching the model the operation semantics.
const PATCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description:
        "A short note to the writer: what you changed, or a clarifying question if the instruction was ambiguous (in which case make no edits). One or two sentences.",
    },
    fields: {
      type: "array",
      description:
        "Edits to single-value fields. Include an entry ONLY for a field you are actually changing; leave the array empty if none change.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: {
            type: "string",
            enum: ["title", "logline", "genre", "pov", "tense", "tone", "setting"],
          },
          value: { type: "string", description: "The new value for this field." },
        },
        required: ["field", "value"],
      },
    },
    characters: {
      type: "array",
      description:
        "Edits to the main-character list. Include ONLY characters you are adding, changing, or removing.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          op: { type: "string", enum: ["add", "update", "remove"] },
          number: {
            type: "integer",
            description:
              "1-based position in the character list shown in the prompt. For 'add', the position to insert at (use list length + 1 to append).",
          },
          name: { type: "string", description: "On 'update', leave empty (\"\") to keep the current name." },
          role: { type: "string", description: "On 'update', leave empty to keep the current role." },
          description: {
            type: "string",
            description: "On 'update', leave empty to keep the current description.",
          },
        },
        required: ["op", "number", "name", "role", "description"],
      },
    },
    chapters: {
      type: "array",
      description:
        "Edits to the chapter list. Include ONLY chapters you are changing — NEVER re-send unchanged chapters; this is what saves the most output. Operations are applied top-to-bottom, and each 'number' refers to the chapter's position AFTER the earlier operations in this list have been applied.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          op: {
            type: "string",
            enum: ["update", "add", "remove", "move"],
            description:
              "'update' edits a chapter in place; 'add' inserts a new one; 'remove' deletes one; 'move' relocates one.",
          },
          number: {
            type: "integer",
            description:
              "1-based chapter number to act on. For 'add', the position to insert at (use chapter count + 1 to append).",
          },
          toNumber: {
            type: "integer",
            description: "For 'move' only: the 1-based position to move the chapter to. Use 0 otherwise.",
          },
          title: {
            type: "string",
            description: "New title (add/update). On 'update', leave empty to keep the current title.",
          },
          description: {
            type: "string",
            description: "New one-line description. On 'update', leave empty to keep the current one.",
          },
          outline: {
            type: "string",
            description: "New detailed outline. On 'update', leave empty to keep the current one.",
          },
        },
        required: ["op", "number", "toNumber", "title", "description", "outline"],
      },
    },
  },
  required: ["reply", "fields", "characters", "chapters"],
} as const;

// ---- Patch application ------------------------------------------------------

/** Apply a patch to the current blueprint, returning a new full blueprint. */
export function applyBlueprintPatch(current: Blueprint, patch: BlueprintPatch): Blueprint {
  // Deep copy so we never mutate the input.
  const next: Blueprint = {
    title: current.title,
    logline: current.logline,
    inferred: {
      ...current.inferred,
      mainCharacters: current.inferred.mainCharacters.map((c) => ({ ...c })),
    },
    chapters: current.chapters.map((c) => ({ ...c })),
  };

  for (const f of patch.fields) {
    if (f.field === "title") next.title = f.value;
    else if (f.field === "logline") next.logline = f.value;
    else next.inferred[f.field] = f.value;
  }

  const chars = next.inferred.mainCharacters;
  for (const op of patch.characters) {
    const i = op.number - 1;
    if (op.op === "add") {
      const at = i >= 0 && i <= chars.length ? i : chars.length;
      chars.splice(at, 0, { name: op.name, role: op.role, description: op.description });
    } else if (op.op === "remove") {
      if (i >= 0 && i < chars.length) chars.splice(i, 1);
    } else {
      const c = chars[i];
      if (c) {
        if (op.name) c.name = op.name;
        if (op.role) c.role = op.role;
        if (op.description) c.description = op.description;
      }
    }
  }

  const chapters = next.chapters;
  for (const op of patch.chapters) {
    const i = op.number - 1;
    if (op.op === "add") {
      const at = i >= 0 && i <= chapters.length ? i : chapters.length;
      chapters.splice(at, 0, { title: op.title, description: op.description, outline: op.outline });
    } else if (op.op === "remove") {
      if (i >= 0 && i < chapters.length) chapters.splice(i, 1);
    } else if (op.op === "move") {
      const to = op.toNumber - 1;
      if (i >= 0 && i < chapters.length && to >= 0 && to < chapters.length) {
        const [moved] = chapters.splice(i, 1);
        chapters.splice(to, 0, moved);
      }
    } else {
      const c = chapters[i];
      if (c) {
        if (op.title) c.title = op.title;
        if (op.description) c.description = op.description;
        if (op.outline) c.outline = op.outline;
      }
    }
  }

  return next;
}

// ---- Entry point ------------------------------------------------------------

export interface BlueprintChatResult {
  reply: string;
  blueprint: Blueprint;
}

export interface ReviseBlueprintInput {
  current: Blueprint;
  history: ChatTurn[];
  instruction: string;
  provider: string;
  model: string;
  apiKey: string;
}

export async function reviseBlueprint(input: ReviseBlueprintInput): Promise<BlueprintChatResult> {
  const llm = getProvider(input.provider, input.apiKey);

  const { data } = await llm.generateJSON({
    model: input.model,
    system: BLUEPRINT_CHAT_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildBlueprintChatPrompt({
          current: input.current,
          history: input.history,
          instruction: input.instruction,
        }),
      },
    ],
    maxTokens: 8000,
    effort: "high",
    thinking: true,
    jsonSchema: PATCH_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "blueprint_patch",
  });

  const patch = PatchSchema.parse(data);
  const blueprint = BlueprintSchema.parse(applyBlueprintPatch(input.current, patch));
  return { reply: patch.reply, blueprint };
}
