import type { VoiceAnalysis } from "@/lib/voice";

// Shared definitions for rendering/editing a voice analysis across the /voices
// library and the story-page picker.

export const VOICE_FIELDS: { key: keyof VoiceAnalysis; label: string; rows: number }[] = [
  { key: "summary", label: "Summary", rows: 4 },
  { key: "sentences", label: "Sentences", rows: 2 },
  { key: "diction", label: "Diction", rows: 2 },
  { key: "dialogue", label: "Dialogue", rows: 2 },
  { key: "narration", label: "Narration", rows: 2 },
  { key: "imagery", label: "Imagery", rows: 2 },
  { key: "register", label: "Register", rows: 2 },
  { key: "quirks", label: "Quirks", rows: 2 },
];

export const EMPTY_ANALYSIS: VoiceAnalysis = {
  summary: "",
  sentences: "",
  diction: "",
  dialogue: "",
  narration: "",
  imagery: "",
  register: "",
  quirks: "",
};
