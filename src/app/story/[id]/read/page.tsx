import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });
  if (!story) notFound();

  const written = story.chapters.filter((c) => (c.content ?? "").trim().length > 0);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href={`/story/${id}`} className="text-sm text-ink-soft hover:text-ink hover:underline">
        ← Back to blueprint
      </Link>

      <header className="mt-4 mb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">{story.title ?? "Untitled"}</h1>
        {story.logline && <p className="mt-3 text-lg text-ink-soft">{story.logline}</p>}
      </header>

      {written.length === 0 ? (
        <p className="text-ink-soft">No chapters written yet. Generate some from the blueprint page.</p>
      ) : (
        <div className="space-y-14">
          {story.chapters.map((c, i) =>
            (c.content ?? "").trim().length > 0 ? (
              <article key={c.id}>
                <h2 className="mb-5 text-2xl font-semibold text-ink">
                  Chapter {i + 1}: {c.title}
                </h2>
                <div className="whitespace-pre-wrap text-[1.05rem] leading-8 text-ink/90">{c.content}</div>
              </article>
            ) : null,
          )}
        </div>
      )}
    </main>
  );
}
