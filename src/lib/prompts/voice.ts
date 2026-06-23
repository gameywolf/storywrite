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
export const VOICE_SYSTEM = ``;

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
