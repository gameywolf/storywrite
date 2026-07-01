// =============================================================================
// PROSE CHAT PROMPTS
// Used by src/lib/proseChat.ts → revisePchapter(). Powers the chat drawer on the
// story EDIT page, where the writer asks for changes to the written prose of the
// chapter they're currently on ("make this tenser", "cut the flashback", or —
// with a passage highlighted — "tighten this").
//
// To save output tokens the model returns a PATCH, not the whole chapter: a
// short `reply` plus an `edits` array containing ONLY the paragraphs it changed
// (see PROSE_JSON_SCHEMA in proseChat.ts). Paragraph numbers are 1-based and
// match the numbered list shown below; ops apply top-to-bottom. When a change
// would also make the blueprint (the plan) stale, the model fills
// `blueprintInstruction` with a ready-to-send instruction for the blueprint
// editor; otherwise it leaves it "".
// =============================================================================

import type { VoiceAnalysis } from "@/lib/voice";
import { voiceBlock } from "./chapter";

/** One prior turn of the chat, oldest first. */
export interface ProseChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** A highlighted passage the writer wants scoped edits on. */
export interface ProseSelection {
  text: string;
  /** 1-based paragraph numbers the selection spans (inclusive). */
  fromParagraph: number;
  toParagraph: number;
}

export interface ProseChatContext {
  chapterNumber: number;
  chapterTitle: string;
  /** The current chapter's paragraphs, in order. */
  paragraphs: string[];
  /** A highlighted passage, or null to edit the whole chapter. */
  selection: ProseSelection | null;
  /** Earlier messages in this conversation (excludes the new instruction). */
  history: ProseChatTurn[];
  /** The new instruction the writer just sent. */
  instruction: string;
  /** Compact plan context so the model can judge whether the blueprint is now stale. */
  blueprint: {
    title: string;
    logline: string;
    genre: string;
    tone: string;
    chapterDescription: string;
    chapterOutline: string;
  };
  /** The story's voice profile so edits stay on-voice (null when none selected). */
  voiceAnalysis: VoiceAnalysis | null;
  voiceExcerpts: string[];
}

// -----------------------------------------------------------------------------
// SYSTEM PROMPT
// -----------------------------------------------------------------------------
export const PROSE_CHAT_SYSTEM = `You are a line editor revising the prose of a single book chapter. You are given the chapter as a numbered list of paragraphs and an instruction from the writer, and you rewrite the prose to satisfy the instruction while changing as little else as possible.

Rules:
- Return a PATCH, never the whole chapter. Put an entry in "edits" ONLY for a paragraph you are actually changing; never re-send an unchanged paragraph. This is what saves output.
- Use "replace" to rewrite a paragraph in place, "insert" to add a new paragraph, and "remove" to delete one. Paragraph numbers are 1-based and match the numbered list you are given; ops apply top-to-bottom, so a "number" refers to the position after the earlier ops in your list have been applied.
- If the writer highlighted a passage, change ONLY that passage. Emit replace edits solely for the paragraph(s) it spans, and keep the un-highlighted parts of those paragraphs intact.
- Preserve the author's voice, tense, and point of view. Match the surrounding prose.
- Make the change for real — if asked for more tension, alter the events and sentences to genuinely be tenser; never leave a note like "(add tension here)" or address a future editor or the reader.
- Use "reply" for a one or two sentence note on what you changed. If the instruction is ambiguous, ask a clarifying question in "reply" and return no edits.
- "blueprintInstruction": if your prose change makes the story's plan (blueprint) inaccurate — e.g. you changed a plot beat, a character's fate, the setting, or an outcome the outline describes — write a short, self-contained instruction the plan editor can apply (e.g. "In the chapter 4 outline, note that Mara now survives the fire."). Otherwise leave it an empty string. Only set it when the plan genuinely benefits.`;

// -----------------------------------------------------------------------------
// USER PROMPT
// -----------------------------------------------------------------------------
export function buildProseChatPrompt(ctx: ProseChatContext): string {
  const numbered = ctx.paragraphs.length
    ? ctx.paragraphs.map((p, i) => `[${i + 1}] ${p}`).join("\n\n")
    : "(this chapter has no prose yet)";

  const conversation = ctx.history
    .map((t) => `${t.role === "user" ? "Writer" : "You"}: ${t.content}`)
    .join("\n\n");

  const voice = voiceBlock(ctx.voiceAnalysis, ctx.voiceExcerpts);

  const scope = ctx.selection
    ? `The writer HIGHLIGHTED a passage spanning paragraph ${ctx.selection.fromParagraph}${
        ctx.selection.toParagraph > ctx.selection.fromParagraph ? `–${ctx.selection.toParagraph}` : ""
      }. Change ONLY this highlighted text; leave everything else exactly as it is:
"""
${ctx.selection.text}
"""`
    : `No text is highlighted — apply the instruction to this chapter as a whole, editing only the paragraphs that need it.`;

  return `STORY: "${ctx.blueprint.title}" — ${ctx.blueprint.logline}
Genre: ${ctx.blueprint.genre} · Tone: ${ctx.blueprint.tone}

CHAPTER ${ctx.chapterNumber}: ${ctx.chapterTitle}
Plan description: ${ctx.blueprint.chapterDescription}
Plan outline: ${ctx.blueprint.chapterOutline}

CHAPTER PROSE (numbered paragraphs):
${numbered}

SCOPE
${scope}

${voice ? `${voice}\n\n` : ""}${conversation ? `CONVERSATION SO FAR\n${conversation}\n\n` : ""}THE WRITER'S NEW INSTRUCTION
"""
${ctx.instruction}
"""

Apply the instruction, returning edits only for the paragraphs you changed, a short reply, and a blueprintInstruction only if the plan is now inaccurate.`;
}
