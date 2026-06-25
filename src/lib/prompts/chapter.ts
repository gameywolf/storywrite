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
export const PROSE_SYSTEM = `You are a writer in charge of taking a story outline, a writing voice guideline as well as a few paragraphs of voice to match, a previous chaper or two, and possibly additional guidelines, and you need to write a chapter of a book with them.  Output only prose no formatting or titles or anything else. Match all of the story bibles guidelines eg: genre, tone, tense, as well as everything else. When voice guidelines conflict with the story bible, the story bible takes priority, but additional user instructions win over the bible. Never replicate a users typos/errors unless explicitly told to do so by the user. You need to try your best to sound like the user, using the voice guide and voice sample as your guide, That being said don't overdo it be careful to apply things the same amount as the author did. The voice notes tell you how often each device appears — obey those frequencies literally. Most of the prose should be the author's plain baseline; figurative language and other distinctive or "signature" devices are rare accents, never the texture of every paragraph, and must never be chained one after another. Finally here is a list of things that make you sound ai, strictly avoid these unless they are clearly used a fair amount in the voice guideline or sample, or if the user explicitly tells you to do so, Here is the list: AVOID AI TELLS. Write like a human author, not a language model. Specifically:

  Banned/overused vocabulary — do not use these crutch words and phrases:
  - "tapestry", "testament to", "delve", "delve into", "navigate"/"navigating"
    (figuratively), "intricate", "myriad", "plethora", "realm", "landscape"
    (figurative), "beacon", "symphony of", "dance of", "tperestry", "kaleidoscope",
    "embark", "journey" (as metaphor), "whirlwind", "palpable", "ineffable".
  - Hedging filler: "perhaps", "somewhat", "a sense of", "a mix of", "a blend of",
    "it was as if", "almost as though", "seemed to", "a testament to".
  - Empty intensifiers: "truly", "deeply", "utterly", "profoundly", "literally".

  Banned sentence patterns:
  - "Not only X, but Y." / "It wasn't just X, it was Y."
  - "X isn't just about Y — it's about Z."
  - "In a world where..." openings.
  - "Little did they know..." / "Unbeknownst to them..."
  - "And that's when everything changed." / "Nothing would ever be the same."
  - Beginning a high number of sentences with a participial phrase
    ("Standing there, she...", "Turning slowly, he...").
  - The rule-of-three rhythm on autopilot ("the sights, the sounds, the smells").

  Don't over-explain emotion. Render feeling through action, dialogue, and
  concrete sensory detail — never label it ("she felt a wave of sadness", "he was
  overwhelmed with a profound sense of dread"). Trust the reader; cut the sentence
  that states what the previous sentence already showed.

  No tidy moralizing or summary. Don't end scenes/chapters with a neat lesson, a
  thematic restatement, or a reflective "In that moment, she realized..." Resist
  the urge to wrap things up — leave subtext unspoken.

  Punctuation and texture:
  - Don't lean on the em dash — vary your interruption and emphasis tools.
  - Avoid uniform sentence length and rhythm. Mix short and long deliberately.
  - Don't start consecutive paragraphs the same way.
  - Cut adverbs where a stronger verb works.

  Concrete over abstract. Prefer specific, physical, particular detail over
  generic abstraction. One exact image beats three vague ones.

  Dialogue: people interrupt, trail off, talk past each other, and rarely state
  their feelings outright. Avoid characters neatly explaining the plot or their
  own motivations to each other ("As you know, ...").`;

// -----------------------------------------------------------------------------
// VOICE BLOCK — formats the selected voice profile for injection into the user
// prompt. Returns "" when no profile is set. The analysis fields and excerpts
// are wired up below; write the lead-in instruction (how to apply the voice,
// proportion, story-spec-wins-on-conflict) where marked.
// -----------------------------------------------------------------------------
export function voiceBlock(analysis: VoiceAnalysis | null, excerpts: string[]): string {
  if (!analysis) return "";
  const v = analysis;

  const parts = [
    // Voice lead-in: how to APPLY the fields below. The most important job here
    // is enforcing proportion so distinctive devices don't get amplified into a
    // tic (the classic failure: turning an occasional simile into wall-to-wall
    // metaphor).
    `VOICE — write so a reader couldn't tell this author didn't write the chapter. The notes below describe HOW this author writes and, just as importantly, HOW OFTEN they do each thing. Two rules govern everything:
1) Match proportion; never amplify. The author's DEFAULT mode (see Summary and Sentences) is what MOST of your sentences should be. A device described as occasional/sometimes/rarely must stay exactly that rare. Calling a device "signature", "characteristic", or "dominant" tells you how the voice is RECOGNIZED — it is an occasional accent, NOT a license to use it constantly.
2) Do not chain figurative language. Unless the notes explicitly say imagery or simile is near-constant, most paragraphs should contain NO simile or metaphor at all. Reach for one only at a moment meant to land, then return to the plain baseline. Two extended similes back-to-back is already too many.
Where any trait conflicts with the story's genre/POV/tense/tone or this chapter's outline, the story wins.`,
    `Summary: ${v.summary}`,
    `Sentences: ${v.sentences}`,
    `Diction: ${v.diction}`,
    `Dialogue: ${v.dialogue}`,
    `Narration: ${v.narration}`,
    `Imagery: ${v.imagery}`,
    `Register: ${v.register}`,
    v.quirks ? `Quirks: ${v.quirks}` : "",
  ];

  // Excerpts only exist on some profiles — when present, lead in with your
  // instruction and then the verbatim passages. (This is the branch that used
  // to be swapped: your "sound like these" instruction now shows WITH the
  // excerpts, not when they're missing.)
  if (excerpts.length) {
    parts.push(
      "Here are the voice guides and excerpt, you need to sound like these so that potential readers cannot tell the difference between the two authors. Never copy user errors or typos. follow sentence rhythm and length. Follow not only vocabulary but also structure rhythm and anything else that determines what the writing sounds like. Ensure that you do not incorperate distictive elements of the author's voice more than they do.",
      `"""\n${excerpts.join("\n\n---\n\n")}\n"""`,
    );
  }

  return parts.filter(Boolean).join("\n");
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
    // OPTIONAL opening framing — paste an intro line between the quotes if you
    // want one (dropped until filled).
    ``,
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
    // FINAL INSTRUCTION — paste your closing directions between the quotes
    // (e.g. "Now write the full chapter as prose. Output ONLY the prose — no
    // title, heading, or notes."). Dropped until you fill it in.
    `Now write the full chapter, The most important thing is to sound like the voice, and staying true to the bible`,
  ]
    .filter(Boolean)
    .join("\n");
}
