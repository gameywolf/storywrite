import { z } from "zod";
import { prisma } from "./db";
import { getProvider, backendProviderName, devBackend } from "./llm";
import { getProviderConfig, getTargetLength } from "./models";
import type { VoiceAnalysis } from "./voice";
import { PROSE_SYSTEM, buildProsePrompt, type ProseInferred } from "./prompts/chapter";
import { STATE_SYSTEM, buildStatePrompt } from "./prompts/storyState";

// Shape of Story.inferred (from the blueprint).
type Inferred = ProseInferred;

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

// Prompts live in ./prompts/chapter.ts and ./prompts/storyState.ts (edit them there).

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
  // The AI chose the chapter count when blueprinting; split the total book
  // length evenly across those chapters for a per-chapter writing target.
  const totalWords = getTargetLength(story.targetLength).words;
  const targetWords = total > 0 ? Math.round(totalWords / total) : totalWords;

  const voiceAnalysis = (story.voiceProfile?.analysis as unknown as VoiceAnalysis | null) ?? null;
  const voiceExcerpts = Array.isArray(story.voiceProfile?.excerpts)
    ? (story.voiceProfile.excerpts as string[])
    : [];

  // 1) Write the prose.
  const { text } = await llm.generateText({
    model: proseModel,
    system: PROSE_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildProsePrompt({
          title: story.title,
          logline: story.logline,
          inferred,
          chapters: story.chapters,
          chapter: next,
          prev,
          runningSummary: story.runningSummary,
          storyBible: story.storyBible,
          voiceAnalysis,
          voiceExcerpts,
          targetWords,
        }),
      },
    ],
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
      system: STATE_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildStatePrompt({
            runningSummary: story.runningSummary,
            storyBible: story.storyBible,
            chapterIndex: next.index,
            chapterTitle: next.title,
            prose,
          }),
        },
      ],
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
