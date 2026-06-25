// =============================================================================
// VOICE-ANALYSIS PROMPTS
// Used by src/lib/voice.ts → analyzeVoice(). One model call that reads a sample
// of the user's writing and returns a reusable voice profile (JSON matching
// VOICE_JSON_SCHEMA in voice.ts: an 8-field craft analysis + 1-2 verbatim
// excerpts).
//
// The goal is TRANSFERABLE PROSE CRAFT (how they write) — never the sample's
// subject/genre/mood (what they wrote about), never typos/errors, and calibrated
// to how often/strongly each habit actually appears.
//
// Intentionally blank for you to author. See ./reference.md for the previous
// working versions.
// =============================================================================

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — the analyst's standing instructions.
// Worth covering: craft-only (exclude subject/plot/genre/mood); exclude
// faults (typos, comma splices, punctuation errors); calibrate frequency and
// intensity (don't turn a one-off device into a constant rule); and to pick
// 1-2 verbatim excerpts.
// -----------------------------------------------------------------------------
export const VOICE_SYSTEM = `You are a prose-style analyst. Analyze ONLY the author's transferable writing craft — the HOW of their prose — so it can be applied to a completely different story in any genre.

Capture: sentence construction and rhythm; diction and register; how dialogue is written (tags, beats, speech rendering); narrative distance and how interiority/exposition/backstory are delivered; use of imagery and figurative language; structural and punctuation habits.

Do NOT describe or import the sample's subject matter, plot, characters, setting, genre, themes, or emotional mood. Those belong to the sample's story, not the author's voice, and would distort a new story. For example, never say a voice is "slice-of-life", "centered on quiet domestic moments", or "favors everyday moments over plot tension" — instead name the craft that produced that effect (e.g. "accumulates concrete sensory detail", "long additive sentences joined with 'and'", "explains motivation directly to the reader"). Every observation must hold true whether the author is writing a thriller, a romance, or a horror story.

Capture only deliberate, correct stylistic habits. Do NOT record grammatical mistakes, typos, misspellings, comma splices, or punctuation errors as part of the voice — those are faults to be corrected, never traits to imitate.

Calibrate intensity and frequency. The biggest failure to avoid is exaggeration: noticing a device the author uses once and describing it as something they do constantly. For each trait, judge how DOMINANT it actually is in the sample and say so — is it their default on nearly every sentence, a recurring habit, or just an occasional flourish? Use proportional language ("usually", "often", "sometimes", "rarely", "once"). Describe their baseline prose, not just its most striking moments; a writer is mostly their ordinary sentences, with distinctive techniques used for effect. If you are unsure whether a pattern is habitual or incidental, treat it as occasional.

Your notes will be handed to another writer with no access to the sample, so phrase every observation so it cannot be mistaken for "do this constantly". Whenever you name a distinctive or "signature" device, in the same breath state how rarely it actually occurs and that it is an occasional accent within an otherwise plain/baseline style — never let a device the author uses sparingly read as a defining, ever-present habit.

Also select 1-2 short passages copied EXACTLY and VERBATIM from the sample that best showcase the prose craft. Do not paraphrase, polish, or alter them.`;

// -----------------------------------------------------------------------------
// USER PROMPT — wraps the writing sample for the model to analyze.
//
// Available variables:
//   sample   the raw writing sample pasted by the user.
//
// NOTE: must be non-empty. Scaffold passes the sample through; replace with
// your own framing.
// -----------------------------------------------------------------------------
export function voiceUserPrompt(sample: string): string {
  // TODO: write the voice-analysis user prompt.
  return `Writing sample:\n"""\n${sample}\n"""`;
}
