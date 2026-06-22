import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

const AnalysisSchema = z.object({
  summary: z.string(),
  sentences: z.string(),
  diction: z.string(),
  dialogue: z.string(),
  narration: z.string(),
  imagery: z.string(),
  register: z.string(),
  quirks: z.string(),
});

const PatchSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty.").max(120).optional(),
    analysis: AnalysisSchema.optional(),
  })
  .refine((b) => b.name !== undefined || b.analysis !== undefined, {
    message: "Nothing to update.",
  });

// Full profile detail (includes the raw sample for viewing/re-editing).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await prisma.voiceProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  return NextResponse.json(profile);
}

// Manual edit (no model call): rename and/or hand-tune the analysis.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request." : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await prisma.voiceProfile.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const data: Prisma.VoiceProfileUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.analysis !== undefined) data.analysis = body.analysis as unknown as Prisma.InputJsonValue;

  const updated = await prisma.voiceProfile.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, analysis: updated.analysis });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.voiceProfile.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  // Stories referencing this profile have voiceProfileId set null by the FK.
  await prisma.voiceProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
