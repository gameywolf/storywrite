import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import BookReader from "@/components/BookReader";
import { readableChapters } from "@/lib/readerChapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReadChapter({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; chapter: string }>;
  searchParams: Promise<{ mode?: string; start?: string }>;
}) {
  const { id, chapter } = await params;
  const { mode, start } = await searchParams;
  const num = Number(chapter);

  const story = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });
  if (!story) notFound();

  const list = readableChapters(story.chapters);
  if (list.length === 0) notFound();

  const pos = list.findIndex((c) => c.number === num);
  if (pos === -1) redirect(`/story/${id}/read/${list[0].number}`);
  const c = list[pos];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <BookReader
        storyId={id}
        title={story.title ?? "Untitled"}
        logline={story.logline}
        chapter={{ number: c.number, title: c.title, content: c.content }}
        chapters={list.map((x) => ({ number: x.number, title: x.title }))}
        prevNumber={pos > 0 ? list[pos - 1].number : null}
        nextNumber={pos < list.length - 1 ? list[pos + 1].number : null}
        position={pos + 1}
        total={list.length}
        isFirst={pos === 0}
        initialMode={mode === "pages" ? "pages" : "scroll"}
        startAtEnd={start === "last"}
      />
    </main>
  );
}
