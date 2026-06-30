import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

const CharacterSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string(),
});

const InferredSchema = z.object({
  genre: z.string(),
  pov: z.string(),
  tense: z.string(),
  tone: z.string(),
  setting: z.string(),
  mainCharacters: z.array(CharacterSchema),
});

const ChapterInputSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  outline: z.string(),
});

const PatchSchema = z.object({
  title: z.string().optional(),
  logline: z.string().optional(),
  inferred: InferredSchema.optional(),
  chapters: z.array(ChapterInputSchema).optional(),
  // Freeform extra guidance applied to every chapter generation.
  instructions: z.string().optional(),
  // null = use the default voice; a string = link that profile.
  voiceProfileId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request." : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true } });
  if (!story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Story-level fields
    const data: Prisma.StoryUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.logline !== undefined) data.logline = body.logline;
    if (body.inferred !== undefined) data.inferred = body.inferred as Prisma.InputJsonValue;
    if (body.instructions !== undefined) data.instructions = body.instructions.trim() || null;
    if (body.voiceProfileId !== undefined) {
      data.voiceProfile = body.voiceProfileId
        ? { connect: { id: body.voiceProfileId } }
        : { disconnect: true };
    }
    if (Object.keys(data).length > 0) {
      await tx.story.update({ where: { id }, data });
    }

    // Chapters: full ordered replacement (handles edit, add, remove, reorder)
    if (body.chapters) {
      const existing = await tx.chapter.findMany({ where: { storyId: id }, select: { id: true } });
      const existingIds = new Set(existing.map((c) => c.id));
      const keepIds = new Set(
        body.chapters.map((c) => c.id).filter((x): x is string => !!x && existingIds.has(x)),
      );

      // Delete chapters that are no longer present.
      const toDelete = [...existingIds].filter((cid) => !keepIds.has(cid));
      if (toDelete.length > 0) {
        await tx.chapter.deleteMany({ where: { id: { in: toDelete } } });
      }

      // Temp-bump kept rows out of the 0..n-1 range so reordering can't collide
      // with the unique (storyId, index) constraint mid-update.
      let temp = 1000;
      for (const cid of keepIds) {
        await tx.chapter.update({ where: { id: cid }, data: { index: temp++ } });
      }

      // Apply the final order.
      for (let i = 0; i < body.chapters.length; i++) {
        const c = body.chapters[i];
        if (c.id && keepIds.has(c.id)) {
          await tx.chapter.update({
            where: { id: c.id },
            data: { index: i, title: c.title, description: c.description, outline: c.outline },
          });
        } else {
          await tx.chapter.create({
            data: { storyId: id, index: i, title: c.title, description: c.description, outline: c.outline },
          });
        }
      }
    }
  });

  // Return the fresh state so the client can resync (new chapters get real ids).
  const updated = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });

  return NextResponse.json({
    title: updated?.title ?? "",
    logline: updated?.logline ?? "",
    inferred: updated?.inferred ?? null,
    chapters: (updated?.chapters ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      outline: c.outline,
    })),
  });
}
