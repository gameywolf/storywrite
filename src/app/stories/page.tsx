import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTargetLength } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  blueprint_ready: "blueprint ready",
  generating: "in progress",
  complete: "complete",
  error: "error",
};

export default async function StoriesPage() {
  const stories = await prisma.story.findMany({
    orderBy: { updatedAt: "desc" },
    include: { chapters: { select: { content: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-ai">AI</span> Author
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/voices" className="text-ink-soft hover:text-ink hover:underline">
            Voices
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover"
          >
            + New story
          </Link>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-ink">Your stories</h2>

      {stories.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-ink-soft">No stories yet.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-medium text-go hover:underline">
            Create your first story →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {stories.map((s) => {
            const total = s.chapters.length;
            const written = s.chapters.filter((c) => (c.content ?? "").trim().length > 0).length;
            const len = getTargetLength(s.targetLength);
            return (
              <li key={s.id}>
                <Link
                  href={`/story/${s.id}`}
                  className="block rounded-xl border border-line bg-surface p-5 transition hover:border-go"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-ink">{s.title || "Untitled"}</h3>
                    <span className="shrink-0 rounded-full bg-control px-2.5 py-1 text-xs text-ink-soft">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                  {s.logline && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{s.logline}</p>}
                  <p className="mt-3 text-xs text-ink-soft">
                    {len.label} · {written}/{total} chapters written · updated{" "}
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
