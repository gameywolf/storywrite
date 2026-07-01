import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Persist an accepted prose edit for a single chapter. AI-free — the edit was
// already produced and previewed via /revise-prose; this just saves the result.

const BodySchema = z.object({
  index: z.number().int().min(0),
  content: z.string(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request." : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const content = body.content.trim();
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

  try {
    await prisma.chapter.update({
      where: { storyId_index: { storyId: id, index: body.index } },
      data: { content, wordCount, status: "drafted" },
    });
  } catch {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, wordCount });
}
