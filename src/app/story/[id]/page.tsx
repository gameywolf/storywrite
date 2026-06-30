import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTargetLength } from "@/lib/models";
import BlueprintEditor, { type EditorInferred } from "@/components/BlueprintEditor";
import BlueprintChat from "@/components/BlueprintChat";
import GenerationPanel from "@/components/GenerationPanel";
import VoiceProfilePicker from "@/components/VoiceProfilePicker";
import type { VoiceAnalysis } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLANK_INFERRED: EditorInferred = {
  genre: "",
  pov: "",
  tense: "",
  tone: "",
  setting: "",
  mainCharacters: [],
};

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [story, voiceProfiles] = await Promise.all([
    prisma.story.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { index: "asc" } },
        voiceProfile: { select: { id: true, analysis: true } },
      },
    }),
    prisma.voiceProfile.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
  ]);

  if (!story) notFound();

  const inferred = {
    ...BLANK_INFERRED,
    ...((story.inferred as unknown as Partial<EditorInferred> | null) ?? {}),
  };
  const len = getTargetLength(story.targetLength);
  const written = story.chapters.filter((c) => (c.content ?? "").trim().length > 0).length;
  const voiceAnalysis = (story.voiceProfile?.analysis as unknown as VoiceAnalysis | null) ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/stories" className="text-sm text-ink-soft hover:text-ink hover:underline">
        ← All stories
      </Link>

      <div className="mt-6" data-tour="generation">
        <GenerationPanel
          storyId={story.id}
          total={story.chapters.length}
          written={written}
          initialInstructions={story.instructions ?? ""}
        >
          <VoiceProfilePicker
            storyId={story.id}
            profiles={voiceProfiles}
            selectedId={story.voiceProfile?.id ?? null}
            selectedAnalysis={voiceAnalysis}
          />
        </GenerationPanel>
      </div>

      <BlueprintChat storyId={story.id} />

      <div className="mt-6" data-tour="blueprint">
        <BlueprintEditor
        // Remount when the stored blueprint changes (e.g. after an AI chat
        // revision) so the editor picks up the fresh server data.
        key={story.updatedAt.toISOString()}
        storyId={story.id}
        initialTitle={story.title ?? ""}
        initialLogline={story.logline ?? ""}
        initialInferred={inferred}
        initialChapters={story.chapters.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          outline: c.outline,
        }))}
          lengthLabel={len.label}
        />
      </div>
    </main>
  );
}
