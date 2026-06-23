import type { VoiceAnalysis } from "@/lib/voice";

// =============================================================================
// CHAPTER-PROSE PROMPTS
// Used by src/lib/generate.ts → generateNextChapter(). The main writing call:
// given all the story context, write the next chapter's prose (plain text, not
// JSON).
//
// Two pieces are blank for you to author — PROSE_SYSTEM (the standing role) and
// the wording inside buildProsePrompt (the per-chapter message). The data
// FORMATTING (character list, chapter map, bible, voice fields) is left wired
// up so you only have to write the instructions around it. See ./reference.md
// for the previous working versions.
// =============================================================================

// ---- Context shapes the builder receives ------------------------------------

export interface ProseInferred {
  genre?: string;
  pov?: string;
  tense?: string;
  tone?: string;
  setting?: string;
  mainCharacters?: { name: string; role: string; description: string }[];
}

export interface ProseChapter {
  index: number; // 0-based
  title: string;
  description: string;
  outline: string;
  content: string | null;
}

export interface ProseContext {
  title: string | null; // book title
  logline: string | null; // one-line summary
  inferred: ProseInferred; // genre/POV/tense/tone/setting + characters
  chapters: ProseChapter[]; // every chapter (for the "map")
  chapter: ProseChapter; // the chapter to write now
  prev: ProseChapter | null; // previous chapter (has .content) or null
  runningSummary: string | null; // recap of the story so far
  storyBible: unknown; // JSON bible (characters/locations/facts/openThreads)
  voiceAnalysis: VoiceAnalysis | null; // selected voice profile, or null
  voiceExcerpts: string[]; // verbatim excerpts from that profile
  targetWords: number; // rough word target for this chapter
}

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — the novelist's standing instructions.
// Worth covering: output ONLY prose (no titles/markdown); match genre/POV/
// tense/tone and stay consistent with the bible; craft guidance (show-don't-
// tell, vary rhythm, real dialogue); anti-"AI tells"; realize the outline as
// full scenes; how VOICE relates to the STYLE line (story spec wins on
// conflict; apply voice in proportion); and correct mechanics (never copy the
// author's typos/errors).
// -----------------------------------------------------------------------------
export const PROSE_SYSTEM = ``;

// -----------------------------------------------------------------------------
// VOICE BLOCK — formats the selected voice profile for injection into the user
// prompt. Returns "" when no profile is set. The analysis fields and excerpts
// are wired up below; write the lead-in instruction (how to apply the voice,
// proportion, story-spec-wins-on-conflict) where marked.
// -----------------------------------------------------------------------------
export function voiceBlock(analysis: VoiceAnalysis | null, excerpts: string[]): string {
  if (!analysis) return "";
  const v = analysis;
  return [
    // TODO: write the voice lead-in instruction (e.g. "VOICE — apply this
    // author's craft in proportion; the story's spec wins on conflict:").
    `Summary: ${v.summary}`,
    `Sentences: ${v.sentences}`,
    `Diction: ${v.diction}`,
    `Dialogue: ${v.dialogue}`,
    `Narration: ${v.narration}`,
    `Imagery: ${v.imagery}`,
    `Register: ${v.register}`,
    v.quirks ? `Quirks: ${v.quirks}` : "",
    excerpts.length
      ? // TODO: write the lead-in for the verbatim excerpts.
        `"""\n${excerpts.join("\n\n---\n\n")}\n"""`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// -----------------------------------------------------------------------------
// USER PROMPT — the per-chapter message. The derived strings below turn the
// structured context into prompt-ready text; arrange and label them with your
// own instructions in the return.
//
// Derived/available pieces:
//   ctx.title, ctx.logline
//   ctx.inferred.{genre,pov,tense,tone,setting}
//   chars   — formatted character list ("- name (role): description")
//   map     — formatted chapter map, marking the one to write
//   bible   — pretty-printed story bible JSON (or "(none yet)")
//   ctx.runningSummary
//   ctx.prev?.content   — full text of the previous chapter (continuity)
//   ctx.chapter.{index,title,description,outline}
//   voice   — the voice block (empty string if no profile selected)
//   ctx.targetWords
//
// NOTE: must be non-empty. Scaffold dumps the pieces with neutral labels so the
// call runs — replace with your own prompt.
// -----------------------------------------------------------------------------
export function buildProsePrompt(ctx: ProseContext): string {
  const chars = (ctx.inferred.mainCharacters ?? [])
    .map((c) => `- ${c.name} (${c.role}): ${c.description}`)
    .join("\n");
  const map = ctx.chapters
    .map((c, i) => `${i + 1}. ${c.title}${i === ctx.chapter.index ? "   <-- WRITE THIS CHAPTER" : ""}`)
    .join("\n");
  const bible = ctx.storyBible ? JSON.stringify(ctx.storyBible, null, 2) : "(none yet)";
  const voice = voiceBlock(ctx.voiceAnalysis, ctx.voiceExcerpts);

  // TODO: write the chapter-writing user prompt.
  return [
    `BOOK: ${ctx.title ?? "Untitled"}`,
    ctx.logline ? `LOGLINE: ${ctx.logline}` : "",
    voice ? `\n${voice}\n` : "",
    `Genre: ${ctx.inferred.genre ?? "—"} · POV: ${ctx.inferred.pov ?? "—"} · Tense: ${ctx.inferred.tense ?? "—"} · Tone: ${ctx.inferred.tone ?? "—"}`,
    `Setting: ${ctx.inferred.setting ?? "—"}`,
    `CHARACTERS:\n${chars || "—"}`,
    `CHAPTER MAP:\n${map}`,
    `STORY BIBLE:\n${bible}`,
    ctx.runningSummary ? `STORY SO FAR:\n${ctx.runningSummary}` : "",
    ctx.prev?.content ? `PREVIOUS CHAPTER:\n"""\n${ctx.prev.content}\n"""` : "",
    `Chapter ${ctx.chapter.index + 1}: ${ctx.chapter.title}`,
    ctx.chapter.description ? `Summary: ${ctx.chapter.description}` : "",
    `Outline:\n${ctx.chapter.outline}`,
    `Target ~${ctx.targetWords} words.`,
  ]
    .filter(Boolean)
    .join("\n");
}
