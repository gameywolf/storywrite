// =============================================================================
// STORY-STATE PROMPTS
// Used by src/lib/generate.ts → generateNextChapter(), in the second call after
// each chapter is written. Feeds the new chapter back in and asks the model to
// refresh the story bible + running summary (JSON matching STATE_JSON_SCHEMA in
// generate.ts). This runs on a cheaper model in production.
//
// Intentionally blank for you to author. See ./reference.md for the previous
// working versions.
// =============================================================================

export interface StateContext {
  runningSummary: string | null; // previous running summary
  storyBible: unknown; // previous bible JSON
  chapterIndex: number; // 0-based index of the chapter just written
  chapterTitle: string;
  prose: string; // the newly written chapter text
}

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — standing instructions for the bookkeeping model.
// Keep it short: it maintains a bible + running summary and must return JSON.
// -----------------------------------------------------------------------------
export const STATE_SYSTEM = ``;

// -----------------------------------------------------------------------------
// USER PROMPT — asks for the merged/updated state.
//
// Derived/available pieces:
//   prevSummary  — ctx.runningSummary, or "(none yet)"
//   prevBible    — pretty-printed previous bible JSON, or "(none yet)"
//   ctx.chapterIndex, ctx.chapterTitle
//   ctx.prose    — the new chapter's full text
//
// Remind the model what JSON to return (runningSummary covering the WHOLE story;
// bible {characters[name,status,notes], locations[name,notes], facts[],
// openThreads[]}) and to merge/dedupe with the previous state.
//
// NOTE: must be non-empty. Scaffold dumps the pieces; replace with your wording.
// -----------------------------------------------------------------------------
export function buildStatePrompt(ctx: StateContext): string {
  const prevSummary = ctx.runningSummary ?? "(none yet)";
  const prevBible = ctx.storyBible ? JSON.stringify(ctx.storyBible, null, 2) : "(none yet)";

  // TODO: write the story-state update user prompt.
  return [
    `PREVIOUS RUNNING SUMMARY:\n${prevSummary}`,
    `PREVIOUS BIBLE:\n${prevBible}`,
    `NEWLY WRITTEN — Chapter ${ctx.chapterIndex + 1}: ${ctx.chapterTitle}:\n"""\n${ctx.prose}\n"""`,
  ].join("\n\n");
}
