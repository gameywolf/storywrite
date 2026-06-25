import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { reviseBlueprint } from "@/lib/blueprintChat";
import { type Blueprint } from "@/lib/blueprint";
import { LLMError, devBackend, backendProviderName } from "@/lib/llm";

export const runtime = "nodejs";
// Revising a full blueprint is a large generation; give it a generous budget.
export const maxDuration = 300;

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const BodySchema = z.object({
  message: z.string().min(1, "Type an instruction for the AI."),
  history: z.array(TurnSchema).max(50).optional(),
});

// Rebuild a Blueprint from the stored story fields + chapter rows. Stored
// `inferred` may be partial (older stories / manual edits), so fill the gaps.
function currentBlueprint(story: {
  title: string | null;
  logline: string | null;
  inferred: unknown;
  chapters: { title: string; description: string; outline: string }[];
}): Blueprint {
  const inf = (story.inferred as Partial<Blueprint["inferred"]> | null) ?? {};
  return {
    title: story.title ?? "",
    logline: story.logline ?? "",
    inferred: {
      genre: inf.genre ?? "",
      pov: inf.pov ?? "",
      tense: inf.tense ?? "",
      tone: inf.tone ?? "",
      setting: inf.setting ?? "",
      mainCharacters: Array.isArray(inf.mainCharacters) ? inf.mainCharacters : [],
    },
    chapters: story.chapters.map((c) => ({
      title: c.title,
      description: c.description,
      outline: c.outline,
    })),
  };
}

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
    include: { chapters: { orderBy: { index: "asc" } } },
  });
  if (!story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  try {
    const result = await reviseBlueprint({
      current: currentBlueprint(story),
      history: body.history ?? [],
      instruction: body.message,
      provider: backendProviderName(story.provider),
      model: story.model,
      apiKey,
    });

    const bp = result.blueprint;
    const oldChapters = story.chapters; // ordered by index

    // The returned blueprint replaces the saved plan wholesale. Recreate the
    // chapter rows from it, carrying any already-written prose over by position
    // so revising the plan doesn't wipe out content the user already generated.
    await prisma.$transaction(async (tx) => {
      await tx.story.update({
        where: { id },
        data: {
          title: bp.title,
          logline: bp.logline,
          inferred: bp.inferred,
          blueprint: bp,
        },
      });

      await tx.chapter.deleteMany({ where: { storyId: id } });

      for (let i = 0; i < bp.chapters.length; i++) {
        const c = bp.chapters[i];
        const old = oldChapters[i];
        await tx.chapter.create({
          data: {
            storyId: id,
            index: i,
            title: c.title,
            description: c.description,
            outline: c.outline,
            content: old?.content ?? null,
            wordCount: old?.wordCount ?? null,
            status: old?.content ? old.status : "pending",
          },
        });
      }
    });

    return NextResponse.json({ reply: result.reply });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Blueprint chat failed:", e);
    return NextResponse.json({ error: "Something went wrong revising the blueprint." }, { status: 500 });
  }
}
