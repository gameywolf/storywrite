import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import BookEditor from "@/components/BookEditor";
import { readableChapters } from "@/lib/readerChapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditChapter({
  params,
}: {
  params: Promise<{ id: string; chapter: string }>;
}) {
  const { id, chapter } = await params;
  const num = Number(chapter);

  const story = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });
  if (!story) notFound();

  const list = readableChapters(story.chapters);
  if (list.length === 0) notFound();

  const pos = list.findIndex((c) => c.number === num);
  if (pos === -1) redirect(`/story/${id}/edit/${list[0].number}`);
  const c = list[pos];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <BookEditor
        storyId={id}
        title={story.title ?? "Untitled"}
        logline={story.logline}
        chapter={{ index: c.index, number: c.number, title: c.title, content: c.content }}
        chapters={list.map((x) => ({ number: x.number, title: x.title }))}
        prevNumber={pos > 0 ? list[pos - 1].number : null}
        nextNumber={pos < list.length - 1 ? list[pos + 1].number : null}
        position={pos + 1}
        total={list.length}
        isFirst={pos === 0}
      />
    </main>
  );
}
