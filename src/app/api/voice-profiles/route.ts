import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { analyzeVoice } from "@/lib/voice";
import { LLMError, devBackend } from "@/lib/llm";
import { DEFAULT_PROVIDER, getProviderConfig } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 120;

const CreateSchema = z.object({
  sample: z.string().min(100, "Paste a longer sample (at least a paragraph or two)."),
  name: z.string().trim().max(120).optional(),
});

// List all profiles in the library (lightweight — analysis for display, no raw sample).
export async function GET() {
  const profiles = await prisma.voiceProfile.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, analysis: true, sample: true, updatedAt: true },
  });
  return NextResponse.json(
    profiles.map((p) => ({
      id: p.id,
      name: p.name,
      analysis: p.analysis,
      hasSample: !!p.sample,
      updatedAt: p.updatedAt,
    })),
  );
}

// Analyze a sample and save it as a new reusable profile.
export async function POST(req: Request) {
  const backend = devBackend();
  const apiKey = req.headers.get("x-llm-key")?.trim() ?? "";
  if (!backend && !apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 400 });
  }

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request." : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const config = getProviderConfig(DEFAULT_PROVIDER);

  try {
    const profile = await analyzeVoice({
      sample: body.sample,
      provider: DEFAULT_PROVIDER,
      model: config.defaultModel,
      apiKey,
    });

    const created = await prisma.voiceProfile.create({
      data: {
        name: body.name && body.name.length > 0 ? body.name : "Untitled voice",
        sample: body.sample,
        analysis: profile.analysis as unknown as Prisma.InputJsonValue,
        excerpts: profile.excerpts as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      id: created.id,
      name: created.name,
      analysis: profile.analysis,
      excerpts: profile.excerpts,
    });
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Voice analysis failed:", e);
    return NextResponse.json({ error: "Voice analysis failed." }, { status: 500 });
  }
}
