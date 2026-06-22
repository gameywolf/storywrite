import { NextResponse } from "next/server";
import { generateNextChapter } from "@/lib/generate";
import { LLMError, devBackend } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const backend = devBackend();
  const apiKey = req.headers.get("x-llm-key")?.trim() ?? "";

  if (!backend && !apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 400 });
  }

  try {
    const result = await generateNextChapter(id, apiKey);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Chapter generation failed:", e);
    const message = e instanceof Error ? e.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
