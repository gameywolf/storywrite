import { z } from "zod";
import { prisma } from "./db";
import { getProvider, backendProviderName, devBackend } from "./llm";
import { getProviderConfig, getTargetLength } from "./models";
import type { VoiceAnalysis } from "./voice";

// Shape of Story.inferred (from the blueprint).
type Inferred = {
  genre?: string;
  pov?: string;
  tense?: string;
  tone?: string;
  setting?: string;
  mainCharacters?: { name: string; role: string; description: string }[];
};

type ChapterRow = {
  id: string;
  index: number;
  title: string;
  description: string;
  outline: string;
  content: string | null;
};

// ---- Story state (bible + running summary) ----------------------------------

const StateSchema = z.object({
  runningSummary: z.string(),
  bible: z.object({
    characters: z.array(z.object({ name: z.string(), status: z.string(), notes: z.string() })),
    locations: z.array(z.object({ name: z.string(), notes: z.string() })),
    facts: z.array(z.string()),
    openThreads: z.array(z.string()),
  }),
});

const STATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    runningSummary: {
      type: "string",
      description: "A concise but complete recap of the whole story so far (a few paragraphs).",
    },
    bible: {
      type: "object",
      additionalProperties: false,
      properties: {
        characters: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              status: { type: "string", description: "current situation / state of the character" },
              notes: { type: "string", description: "traits, relationships, what they know" },
            },
            required: ["name", "status", "notes"],
          },
        },
        locations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { name: { type: "string" }, notes: { type: "string" } },
            required: ["name", "notes"],
          },
        },
        facts: { type: "array", items: { type: "string" }, description: "established facts that must stay consistent" },
        openThreads: { type: "array", items: { type: "string" }, description: "unresolved questions / plot threads" },
      },
      required: ["characters", "locations", "facts", "openThreads"],
    },
  },
  required: ["runningSummary", "bible"],
} as const;

// ---- Prompts ----------------------------------------------------------------

const PROSE_SYSTEM = `You are a novelist ghost-writing a book. You write vivid, immersive, publishable prose.

Hard rules:
- Output ONLY the chapter's prose. No chapter title, no heading, no author notes, no markdown.
- Match the established genre, point of view, tense, and tone EXACTLY, and stay consistent with the story so far and the story bible. Never contradict an established fact.
- Show, don't tell. Vary sentence rhythm and length. Write natural, character-specific dialogue.
- Avoid clichés and "AI tells": no "tapestry", "testament to", "delve", "in a world where", no over-explaining emotions, no tidy moralizing.
- Realize the chapter's outline as one or more full scenes. Advance plot and character, and end with momentum into the next chapter.
- The STYLE line (genre, POV, tense, tone, setting) and this chapter's summary/outline are authoritative for the story's concrete choices. If a VOICE section is present, apply it for HOW the prose reads — sentence rhythm, diction, dialogue handling, imagery, register, quirks — so the chapter reads as though that author wrote it. Apply each voice trait in the proportion the section describes: a device the author uses occasionally or for emphasis should stay occasional, never become a tic that appears in every sentence. Reproduce their ordinary baseline prose, not a caricature built from their most distinctive moments. But where a voice trait conflicts with the STYLE line or the chapter summary (for example a different point of view or tense), follow the story's specification, not the voice. The excerpts show the author's actual prose: match their craft, not their content, subject, or mood.
- Always write with correct grammar, spelling, and punctuation. Match the author's craft, but do NOT reproduce any typos, misspellings, comma splices, or punctuation errors that appear in their excerpts — imitate their style, never their mistakes.`;

function voiceBlock(voiceAnalysis: unknown, voiceExcerpts: unknown): string {
  const v = voiceAnalysis as VoiceAnalysis | null;
  if (!v) return "";
  const excerpts = Array.isArray(voiceExcerpts) ? (voiceExcerpts as string[]) : [];
  return [
    "VOICE — apply this author's prose craft and rhythm; keep THIS story's own genre, mood, plot, and content. Apply each trait in the PROPORTION described below — if a habit is noted as occasional or for emphasis, use it sparingly, not in every sentence; match the author's ordinary baseline prose, with distinctive devices reserved for effect. Do not amplify any trait beyond how often the author actually uses it. If any item below conflicts with the story details or this chapter's summary (e.g. perspective or tense), the story's specification wins:",
    `Summary: ${v.summary}`,
    `Sentences: ${v.sentences}`,
    `Diction: ${v.diction}`,
    `Dialogue: ${v.dialogue}`,
    `Narration: ${v.narration}`,
    `Imagery: ${v.imagery}`,
    `Register: ${v.register}`,
    v.quirks ? `Quirks: ${v.quirks}` : "",
    excerpts.length
      ? `The author's actual prose — match this craft and rhythm closely (not its subject, mood, or any typos/punctuation errors):\n"""\n${excerpts.join("\n\n---\n\n")}\n"""`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function proseUser(story: { title: string | null; logline: string | null; runningSummary: string | null; storyBible: unknown; voiceProfile: { analysis: unknown; excerpts: unknown } | null }, inferred: Inferred, chapters: ChapterRow[], chapter: ChapterRow, prev: ChapterRow | null, targetWords: number): string {
  const chars = (inferred.mainCharacters ?? []).map((c) => `- ${c.name} (${c.role}): ${c.description}`).join("\n");
  const map = chapters.map((c, i) => `${i + 1}. ${c.title}${i === chapter.index ? "   <-- WRITE THIS CHAPTER" : ""}`).join("\n");
  const bible = story.storyBible ? JSON.stringify(story.storyBible, null, 2) : "(none yet)";
  const voice = voiceBlock(story.voiceProfile?.analysis ?? null, story.voiceProfile?.excerpts ?? null);

  return [
    `BOOK: ${story.title ?? "Untitled"}`,
    story.logline ? `LOGLINE: ${story.logline}` : "",
    "",
    voice ? `${voice}\n` : "",
    "STYLE — match exactly:",
    `Genre: ${inferred.genre ?? "—"} · POV: ${inferred.pov ?? "—"} · Tense: ${inferred.tense ?? "—"} · Tone: ${inferred.tone ?? "—"}`,
    `Setting: ${inferred.setting ?? "—"}`,
    "",
    `CHARACTERS:\n${chars || "—"}`,
    "",
    `CHAPTER MAP:\n${map}`,
    "",
    `STORY BIBLE (established facts — stay consistent):\n${bible}`,
    "",
    story.runningSummary ? `STORY SO FAR:\n${story.runningSummary}\n` : "",
    prev?.content ? `PREVIOUS CHAPTER (for voice + continuity):\n"""\n${prev.content}\n"""\n` : "",
    `NOW WRITE Chapter ${chapter.index + 1}: ${chapter.title}`,
    chapter.description ? `Summary: ${chapter.description}` : "",
    `Outline to realize:\n${chapter.outline}`,
    "",
    `Write the full chapter as prose, aiming for roughly ${targetWords} words. Output ONLY the prose.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function stateUser(story: { runningSummary: string | null; storyBible: unknown }, chapter: ChapterRow, prose: string): string {
  return [
    "Update the story bible and running summary to incorporate the newly written chapter below.",
    "",
    `PREVIOUS RUNNING SUMMARY:\n${story.runningSummary ?? "(none yet)"}`,
    "",
    `PREVIOUS BIBLE:\n${story.storyBible ? JSON.stringify(story.storyBible, null, 2) : "(none yet)"}`,
    "",
    `NEWLY WRITTEN — Chapter ${chapter.index + 1}: ${chapter.title}:\n"""\n${prose}\n"""`,
    "",
    "Return JSON: `runningSummary` (recap of the WHOLE story so far, a few paragraphs) and `bible` {characters[name,status,notes], locations[name,notes], facts[], openThreads[]}. Merge new info with previous, keep it consistent and deduplicated.",
  ].join("\n");
}

// ---- Entry point ------------------------------------------------------------

export interface GenerateResult {
  generated: boolean;
  done: boolean;
  chapterIndex?: number;
  title?: string;
  wordCount?: number;
  written: number;
  total: number;
}

/** Generate the next un-written chapter (in order), then refresh the story bible + summary. */
export async function generateNextChapter(storyId: string, apiKey: string): Promise<GenerateResult> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: {
      chapters: { orderBy: { index: "asc" } },
      voiceProfile: { select: { analysis: true, excerpts: true } },
    },
  });
  if (!story) throw new Error("Story not found.");

  const total = story.chapters.length;
  const isWritten = (c: ChapterRow) => !!c.content && c.content.trim().length > 0;
  const written = story.chapters.filter(isWritten).length;
  const next = story.chapters.find((c) => !isWritten(c));

  if (!next) {
    if (story.status !== "complete") {
      await prisma.story.update({ where: { id: storyId }, data: { status: "complete" } });
    }
    return { generated: false, done: true, written, total };
  }

  const providerName = backendProviderName(story.provider);
  const onDev = devBackend() !== null;
  const llm = getProvider(providerName, apiKey);
  const proseModel = story.model;
  const stateModel = onDev ? story.model : getProviderConfig(story.provider).auxModel;

  const inferred = (story.inferred as Inferred | null) ?? {};
  const prev = next.index > 0 ? story.chapters[next.index - 1] : null;
  const targetWords = getTargetLength(story.targetLength).wordsPerChapter;

  // 1) Write the prose.
  const { text } = await llm.generateText({
    model: proseModel,
    system: PROSE_SYSTEM,
    messages: [{ role: "user", content: proseUser(story, inferred, story.chapters, next, prev, targetWords) }],
    maxTokens: 8000,
    effort: "high",
    thinking: true,
  });

  const prose = text.trim();
  const wordCount = prose ? prose.split(/\s+/).filter(Boolean).length : 0;

  await prisma.chapter.update({
    where: { id: next.id },
    data: { content: prose, wordCount, status: "drafted" },
  });

  // 2) Refresh story state (bible + running summary). Non-fatal if it fails.
  try {
    const { data } = await llm.generateJSON({
      model: stateModel,
      system: "You maintain a story bible and a running summary for a novel in progress. Return only JSON.",
      messages: [{ role: "user", content: stateUser(story, next, prose) }],
      maxTokens: 4000,
      jsonSchema: STATE_JSON_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "story_state",
    });
    const state = StateSchema.parse(data);
    await prisma.story.update({
      where: { id: storyId },
      data: { storyBible: state.bible, runningSummary: state.runningSummary },
    });
  } catch (e) {
    console.error("Story-state update failed (chapter still saved):", e);
  }

  const nowWritten = written + 1;
  const done = nowWritten >= total;
  await prisma.story.update({
    where: { id: storyId },
    data: { currentChapter: next.index + 1, status: done ? "complete" : "generating" },
  });

  return { generated: true, done, chapterIndex: next.index, title: next.title, wordCount, written: nowWritten, total };
}
