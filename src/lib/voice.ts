import { z } from "zod";
import { getProvider, backendProviderName } from "./llm";

// Analyze a user's writing sample into a reusable voice profile: the author's
// transferable PROSE CRAFT (how they write), not the sample's subject/genre/mood
// (what they wrote about). The craft must apply to any story in any genre. We
// also keep 1-2 verbatim excerpts — the strongest voice signal.

export const VoiceSchema = z.object({
  analysis: z.object({
    summary: z.string(),
    sentences: z.string(),
    diction: z.string(),
    dialogue: z.string(),
    narration: z.string(),
    imagery: z.string(),
    register: z.string(),
    quirks: z.string(),
  }),
  excerpts: z.array(z.string()),
});

export type VoiceProfile = z.infer<typeof VoiceSchema>;
export type VoiceAnalysis = VoiceProfile["analysis"];

const VOICE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    analysis: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: {
          type: "string",
          description:
            "How the author writes, in transferable craft terms only. No subject matter, genre, plot, setting, themes, or the sample's mood. Calibrate every claim to how OFTEN and how STRONGLY the author actually does it — separate their dominant default habits from occasional flourishes. Never present a technique used once or twice as a constant rule.",
        },
        sentences: {
          type: "string",
          description:
            "Sentence length, structure, and rhythm/cadence. Describe the author's typical default AND their range — e.g. 'mostly medium-length and grammatically complete, with the occasional short fragment for emphasis', not 'writes in fragments'. Note roughly how frequently any distinctive pattern appears (rarely / sometimes / often).",
        },
        diction: { type: "string", description: "Vocabulary level and word-choice register, and how consistently it holds. Flag a striking word choice as occasional rather than characteristic unless it genuinely recurs." },
        dialogue: { type: "string", description: "How dialogue is rendered — tags, action beats, speech patterns — and how habitual each pattern is versus an isolated instance." },
        narration: {
          type: "string",
          description:
            "Narrative distance and how interiority, exposition, and backstory are delivered (e.g. direct telling vs. close showing). Note the author's predominant mode and how often they depart from it.",
        },
        imagery: { type: "string", description: "Use of metaphor, simile, and sensory/figurative language, including its DENSITY — sparse, moderate, or heavy. A single vivid image is not a habit of heavy imagery." },
        register: {
          type: "string",
          description:
            "The prose's habitual attitude as a craft trait (e.g. plain, wry, ornate, ironic) — NOT the mood of the sample's events.",
        },
        quirks: {
          type: "string",
          description:
            "Distinctive DELIBERATE punctuation, syntax, or structural habits — intentional stylistic choices only, and only ones that genuinely RECUR. State how frequently each appears; do not list a one-off device as a habit. Never record typos, misspellings, grammatical errors, or punctuation mistakes; those are faults to fix, not traits.",
        },
      },
      required: ["summary", "sentences", "diction", "dialogue", "narration", "imagery", "register", "quirks"],
    },
    excerpts: {
      type: "array",
      description: "1-2 short passages copied EXACTLY (verbatim) from the sample that best showcase the prose craft.",
      items: { type: "string" },
    },
  },
  required: ["analysis", "excerpts"],
} as const;

const VOICE_SYSTEM = `You are a prose-style analyst. Analyze ONLY the author's transferable writing craft — the HOW of their prose — so it can be applied to a completely different story in any genre.

Capture: sentence construction and rhythm; diction and register; how dialogue is written (tags, beats, speech rendering); narrative distance and how interiority/exposition/backstory are delivered; use of imagery and figurative language; structural and punctuation habits.

Do NOT describe or import the sample's subject matter, plot, characters, setting, genre, themes, or emotional mood. Those belong to the sample's story, not the author's voice, and would distort a new story. For example, never say a voice is "slice-of-life", "centered on quiet domestic moments", or "favors everyday moments over plot tension" — instead name the craft that produced that effect (e.g. "accumulates concrete sensory detail", "long additive sentences joined with 'and'", "explains motivation directly to the reader"). Every observation must hold true whether the author is writing a thriller, a romance, or a horror story.

Capture only deliberate, correct stylistic habits. Do NOT record grammatical mistakes, typos, misspellings, comma splices, or punctuation errors as part of the voice — those are faults to be corrected, never traits to imitate.

Calibrate intensity and frequency. The biggest failure to avoid is exaggeration: noticing a device the author uses once and describing it as something they do constantly. For each trait, judge how DOMINANT it actually is in the sample and say so — is it their default on nearly every sentence, a recurring habit, or just an occasional flourish? Use proportional language ("usually", "often", "sometimes", "rarely", "once"). Describe their baseline prose, not just its most striking moments; a writer is mostly their ordinary sentences, with distinctive techniques used for effect. If you are unsure whether a pattern is habitual or incidental, treat it as occasional.

Also select 1-2 short passages copied EXACTLY and VERBATIM from the sample that best showcase the prose craft. Do not paraphrase, polish, or alter them.`;

export interface AnalyzeVoiceInput {
  sample: string;
  provider: string;
  model: string;
  apiKey: string;
}

export async function analyzeVoice(input: AnalyzeVoiceInput): Promise<VoiceProfile> {
  const llm = getProvider(backendProviderName(input.provider), input.apiKey);
  const { data } = await llm.generateJSON({
    model: input.model,
    system: VOICE_SYSTEM,
    messages: [{ role: "user", content: `Writing sample:\n"""\n${input.sample}\n"""` }],
    maxTokens: 4000,
    effort: "high",
    thinking: true,
    jsonSchema: VOICE_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "voice_profile",
  });
  return VoiceSchema.parse(data);
}
