import type { TargetLength } from "@/lib/models";

// =============================================================================
// BLUEPRINT PROMPTS
// Used by src/lib/blueprint.ts → generateBlueprint(). One model call that turns
// the writer's freeform idea into a structured, chapter-by-chapter plan.
//
// The call is forced to return JSON matching BLUEPRINT_JSON_SCHEMA (in
// blueprint.ts), so the prompt should ask the model to PLAN — title, logline,
// inferred genre/POV/tense/tone/setting + main characters, and a detailed
// outline per chapter — not to write prose.
//
// These are intentionally blank for you to author. See ./reference.md for the
// previous working versions to copy from.
// =============================================================================

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — the model's standing role/instructions for blueprinting.
// Cover: who it is (story architect), honoring vs. inventing the writer's
// details, what each chapter needs (title/description/detailed outline), the
// dramatic arc to build, and "plan only — no prose".
// -----------------------------------------------------------------------------
export const BLUEPRINT_SYSTEM = `You are a story architect. You need to take a writers summary of a story they want written and turn it into a more detailed plan. Always honor the authors intended plan to every detail and never change what they have given you. Expand and grow from their ideas and take creative direction that feels similar to what they have given to you unless they explicitly say to do otherwise. you need to output the plan in the form of chapters with titles, descriptions(which should be a couple sentences of main points), and detailed summarys(an in depth guide of the chapter following what happens and anything important. this should only be about a paragraph. the ai uses these as a guide to write the chapters). The book also needs inferred genre/POV/tense/tone/setting + main characters. these details will be passed to another ai agent later to write the book from. you will be given a target chapter length for the book as a whole and you should infer by the type of story how many chapters it should have or how long chapters should be but it should be close to the books total word count, though chapters should vary in length. pacing should be handled carefully and every chapter should add something unless the user asks otherwise but does not need to significantly move the plot forward, chapters can be there to simply add depth or detail to a place or character.`;

// -----------------------------------------------------------------------------
// USER PROMPT — the per-request message. Compose it from the variables below.
//
// Available variables:
//   description   the writer's freeform story idea (verbatim).
//   len.label     human label for the length, e.g. "Novel (~90,000 words)".
//   len.words     TOTAL target book length in words. Let the model choose the
//                 chapter count and each chapter's length to fit this.
// -----------------------------------------------------------------------------
export function blueprintUserPrompt(description: string, len: TargetLength): string {
  return `Here is the writer's story idea:

"""
${description}
"""

Target total length: about ${len.words.toLocaleString()} words (${len.label}).

Decide how many chapters this story needs and roughly how long each should be, so the chapter lengths add up to about that total — let them vary with the pacing rather than all being the same size. Then produce the full plan: a book title, a one-sentence logline, the inferred genre, POV, tense, tone, setting, and main characters, and for every chapter a title, a short description, and a detailed beat-by-beat outline.`;
}
