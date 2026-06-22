import Link from "next/link";
import { prisma } from "@/lib/db";
import VoicesManager, { type ProfileListItem } from "@/components/VoicesManager";
import type { VoiceAnalysis } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VoicesPage() {
  const rows = await prisma.voiceProfile.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, analysis: true, sample: true, _count: { select: { stories: true } } },
  });

  const profiles: ProfileListItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    analysis: p.analysis as unknown as VoiceAnalysis,
    hasSample: !!p.sample,
    storyCount: p._count.stories,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-ai">AI</span> Author
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/stories" className="text-ink-soft hover:text-ink hover:underline">
            Stories
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover"
          >
            + New story
          </Link>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">Voices</h2>
        <span className="rounded bg-ai-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-ink">
          AI
        </span>
      </div>
      <p className="mb-6 text-sm text-ink-soft">
        Analyze a sample of your writing once, then reuse that voice across any of your books. Editing a voice updates
        every story that uses it.
      </p>

      <VoicesManager initialProfiles={profiles} />
    </main>
  );
}
