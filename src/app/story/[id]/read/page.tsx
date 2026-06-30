import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import BookReader from "@/components/BookReader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });
  if (!story) notFound();

  // Only chapters with prose, keeping their position in the full chapter list as
  // the display number.
  const chapters = story.chapters
    .map((c, i) => ({ number: i + 1, title: c.title, content: (c.content ?? "").trim() }))
    .filter((c) => c.content.length > 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <BookReader storyId={id} title={story.title ?? "Untitled"} logline={story.logline} chapters={chapters} />
    </main>
  );
}
