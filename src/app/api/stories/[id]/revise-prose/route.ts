import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { revisePchapter } from "@/lib/proseChat";
import { splitParagraphs } from "@/lib/prosePatch";
import { LLMError, devBackend, backendProviderName } from "@/lib/llm";
import type { Blueprint } from "@/lib/blueprint";
import type { VoiceAnalysis } from "@/lib/voice";

export const runtime = "nodejs";
// Revising prose is a large generation; give it a generous budget.
export const maxDuration = 300;

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const SelectionSchema = z.object({
  text: z.string().min(1),
  fromParagraph: z.number().int().min(1),
  toParagraph: z.number().int().min(1),
});

const BodySchema = z.object({
  message: z.string().min(1, "Type an instruction for the AI."),
  history: z.array(TurnSchema).max(50).optional(),
  chapterIndex: z.number().int().min(0),
  selection: SelectionSchema.nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const backend = devBackend();
  const apiKey = req.headers.get("x-llm-key")?.trim() ?? "";

  if (!backend && !apiKey) {
    return NextResponse.json({ error: "Missing API key. Add it in settings." }, { status: 400 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request." : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const story = await prisma.story.findUnique({
    where: { id },
    include: {
      chapters: { orderBy: { index: "asc" } },
      voiceProfile: { select: { analysis: true, excerpts: true } },
    },
  });
  if (!story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  const chapter = story.chapters.find((c) => c.index === body.chapterIndex);
  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  const paragraphs = splitParagraphs(chapter.content ?? "");
  const inf = (story.inferred as Partial<Blueprint["inferred"]> | null) ?? {};
  const voiceAnalysis = (story.voiceProfile?.analysis as unknown as VoiceAnalysis | null) ?? null;
  const voiceExcerpts = Array.isArray(story.voiceProfile?.excerpts)
    ? (story.voiceProfile.excerpts as string[])
    : [];

  try {
    const proposal = await revisePchapter({
      chapterNumber: chapter.index + 1,
      chapterTitle: chapter.title,
      paragraphs,
      selection: body.selection ?? null,
      history: body.history ?? [],
      instruction: body.message,
      blueprint: {
        title: story.title ?? "",
        logline: story.logline ?? "",
        genre: inf.genre ?? "",
        tone: inf.tone ?? "",
        chapterDescription: chapter.description,
        chapterOutline: chapter.outline,
      },
      voiceAnalysis,
      voiceExcerpts,
      provider: backendProviderName(story.provider),
      model: story.model,
      apiKey,
    });

    return NextResponse.json(proposal);
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Prose revision failed:", e);
    return NextResponse.json({ error: "Something went wrong revising the prose." }, { status: 500 });
  }
}
