import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readableChapters } from "@/lib/readerChapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Editing is one chapter per URL. Send /edit to the first written chapter.
export default async function EditIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });
  if (!story) notFound();

  const list = readableChapters(story.chapters);
  if (list.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <p className="text-ink-soft">No chapters written yet. Generate some from the blueprint page.</p>
      </main>
    );
  }

  redirect(`/story/${id}/edit/${list[0].number}`);
}
