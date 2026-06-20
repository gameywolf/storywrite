import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateBlueprint } from "@/lib/blueprint";
import { LLMError, devBackend, backendProviderName } from "@/lib/llm";
import { PROVIDERS, TARGET_LENGTHS } from "@/lib/models";

export const runtime = "nodejs";
// Generation can take a while; allow a generous budget.
export const maxDuration = 300;

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
    const blueprint = await generateBlueprint({
      description: body.description,
      targetLength: body.targetLength,
      provider: backendProviderName(body.provider),
      model: body.model,
      apiKey,
    });

    const story = await prisma.story.create({
      data: {
        title: blueprint.title,
        logline: blueprint.logline,
        description: body.description,
        targetLength: body.targetLength,
        provider: body.provider,
        model: body.model,
        status: "blueprint_ready",
        blueprint,
        inferred: blueprint.inferred,
        chapters: {
          create: blueprint.chapters.map((c, i) => ({
            index: i,
            title: c.title,
            description: c.description,
            outline: c.outline,
          })),
        },
      },
    });

    return NextResponse.json({ id: story.id }, { status: 201 });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Blueprint generation failed:", e);
    return NextResponse.json({ error: "Something went wrong generating the blueprint." }, { status: 500 });
  }
}

// Used by the form to know what length labels exist (kept trivial for now).
export async function GET() {
  return NextResponse.json({ targetLengths: Object.values(TARGET_LENGTHS) });
}
