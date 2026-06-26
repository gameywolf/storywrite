import { NextResponse } from "next/server";
import { z } from "zod";
import { generateClarifyingQuestions } from "@/lib/clarify";
import { LLMError, devBackend, backendProviderName } from "@/lib/llm";
import { PROVIDERS } from "@/lib/models";

export const runtime = "nodejs";
// Lighter than blueprinting, but still a model call — give it room.
export const maxDuration = 120;

const BodySchema = z.object({
  description: z.string().min(10, "Tell me a little more about your story (at least a sentence)."),
  targetLength: z.enum(["SHORT_STORY", "NOVELLA", "NOVEL", "EPIC"]),
  provider: z.string(),
  model: z.string(),
});

export async function POST(req: Request) {
  const backend = devBackend();
  const apiKey = req.headers.get("x-llm-key")?.trim() ?? "";

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request." : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Normal (API) mode requires a key and a known provider/model. The dev
  // backends (mock / claude CLI) ignore both.
  if (!backend) {
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key. Add it in settings." }, { status: 400 });
    }
    const providerConfig = PROVIDERS[body.provider];
    if (!providerConfig) {
      return NextResponse.json({ error: `Unknown provider: ${body.provider}` }, { status: 400 });
    }
    if (!providerConfig.generationModels.some((m) => m.id === body.model)) {
      return NextResponse.json({ error: `Unknown model: ${body.model}` }, { status: 400 });
    }
  }

  try {
    const questions = await generateClarifyingQuestions({
      description: body.description,
      targetLength: body.targetLength,
      provider: backendProviderName(body.provider),
      model: body.model,
      apiKey,
    });
    return NextResponse.json({ questions });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Clarifying-question generation failed:", e);
    const detail = e instanceof Error ? `: ${e.message}` : "";
    return NextResponse.json({ error: `Couldn't generate questions${detail}` }, { status: 500 });
  }
}
