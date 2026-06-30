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
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href={`/story/${id}`} className="text-sm text-ink-soft hover:text-ink hover:underline">
        ← Back to blueprint
      </Link>

      <div className="mt-4 rounded-2xl border border-line bg-surface px-6 py-12 shadow-card sm:px-14 sm:py-16">
      <header className="mb-14 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {story.title ?? "Untitled"}
        </h1>
        {story.logline && (
          <p className="mx-auto mt-4 max-w-xl font-reading text-lg italic text-ink-soft">{story.logline}</p>
        )}
        <div aria-hidden className="mx-auto mt-6 flex items-center justify-center gap-3 text-ai">
          <span className="h-px w-12 bg-line" />
          <span className="text-sm">❦</span>
          <span className="h-px w-12 bg-line" />
        </div>
      </header>

      {written.length === 0 ? (
        <p className="text-ink-soft">No chapters written yet. Generate some from the blueprint page.</p>
      ) : (
        <div className="space-y-16">
          {story.chapters.map((c, i) =>
            (c.content ?? "").trim().length > 0 ? (
              <article key={c.id}>
                <header className="mb-7 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                    Chapter {i + 1}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{c.title}</h2>
                </header>
                <div className="whitespace-pre-wrap font-reading text-[1.075rem] leading-[1.85] text-ink/90">
                  {c.content}
                </div>
                {i < written.length - 1 && (
                  <div aria-hidden className="mt-16 text-center text-ai/70">❦</div>
                )}
              </article>
            ) : null,
          )}
        </div>
      )}
      </div>
    </main>
  );
}
