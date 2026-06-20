import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTargetLength } from "@/lib/models";
import BlueprintEditor, { type EditorInferred } from "@/components/BlueprintEditor";

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

  const story = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });

  if (!story) notFound();

  const inferred = {
    ...BLANK_INFERRED,
    ...((story.inferred as unknown as Partial<EditorInferred> | null) ?? {}),
  };
  const len = getTargetLength(story.targetLength);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-black/50 hover:underline dark:text-white/50">
        ← New story
      </Link>

      <div className="mt-6">
        <BlueprintEditor
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
