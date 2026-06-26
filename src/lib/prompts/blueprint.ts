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
export function blueprintUserPrompt(
  description: string,
  len: TargetLength,
  answers: ClarifyAnswer[] = [],
): string {
  const clarifications = answers.length
    ? `\n\nBefore planning, the writer answered some clarifying questions about the idea. Treat each answer as part of their intent — honor it exactly as you would the original idea, and resolve the corresponding ambiguity their way:\n${answers
        .map((a) => `- ${a.question}\n  → ${a.answer}`)
        .join("\n")}\n`
    : "";

  return `Here is the writer's story idea:

"""
${description}
"""
${clarifications}
Target total length: about ${len.words.toLocaleString()} words (${len.label}).

Decide how many chapters this story needs and roughly how long each should be, so the chapter lengths add up to about that total — let them vary with the pacing rather than all being the same size. Then produce the full plan: a book title, a one-sentence logline, the inferred genre, POV, tense, tone, setting, and main characters, and for every chapter a title, a short description, and a detailed beat-by-beat outline.`;
}

// =============================================================================
// CLARIFYING-QUESTIONS PROMPTS
// Used by src/lib/clarify.ts → generateClarifyingQuestions(). A lightweight call
// that runs BEFORE the blueprint: it reads the writer's idea, finds the biggest
// ambiguities/gaps, and returns a handful of multiple-choice questions. The
// writer's answers are then fed into blueprintUserPrompt() above.
//
// Forced to return JSON matching CLARIFY_JSON_SCHEMA (in clarify.ts): a list of
// questions, each with a short topic label and 2-5 answer options. The UI always
// adds its own free-text "Other" box, so the model should NOT emit one.
// =============================================================================

/** A single answered clarifying question, fed back into blueprint generation. */
export interface ClarifyAnswer {
  question: string;
  answer: string;
}

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — the standing role for the question-finding step.
// -----------------------------------------------------------------------------
export const CLARIFY_SYSTEM = `You help a writer sharpen a story idea before it is planned in detail. Read their idea and find the places where it is most open-ended — the decisions a planner would otherwise have to GUESS, and where guessing wrong would most change the resulting book. These are things like: whose point of view the story follows, the tone and how dark or light it goes, the ending or the shape of the resolution, a central character's true motive or arc, which genre lane it leans into, the time period or setting, the scope and stakes, or which of several promising threads should be the spine.

Ask only about the highest-impact open questions — never trivia, never craft minutiae the writer wouldn't have an opinion on yet. Surface the genuine forks in the road.

Return between 2 and 10 questions. Ask fewer when the idea is already detailed and only a couple of real ambiguities remain; ask more only when it is a bare premise with many wide-open directions. For each question provide:
- a short topic label (2-4 words, e.g. "Point of view", "The ending", "Tone");
- a clear, specific question;
- 2 to 5 answer options, each a concrete, genuinely DIFFERENT direction the story could take. Options must be real alternatives the writer might actually choose — phrase them as decisions, not vague moods. No strawmen, no near-duplicates, no "all of the above".

Hard rules: Never ask about anything the writer has already specified — only about what is genuinely unstated or ambiguous. Never propose an option that contradicts what they have explicitly said. Do not include an "Other" or "something else" option; the writer will always be able to type their own answer, so your options just need to cover the most likely good directions.`;

// -----------------------------------------------------------------------------
// USER PROMPT — wraps the idea (and target length, for scope context).
// -----------------------------------------------------------------------------
export function clarifyUserPrompt(description: string, len: TargetLength): string {
  return `Here is the writer's story idea:

"""
${description}
"""

They are aiming for about ${len.words.toLocaleString()} words (${len.label}), so keep the scope of your questions appropriate to that size.

Find the biggest open questions and ambiguities in this idea — the decisions that would most shape the finished book — and ask the writer to resolve them, following your instructions. Return only the questions.`;
}
