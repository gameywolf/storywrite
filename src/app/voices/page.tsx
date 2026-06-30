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
      <div className="mb-2 flex items-center gap-2.5">
        <h1 className="text-3xl font-semibold tracking-tight">Voices</h1>
        <span className="rounded bg-ai-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-ink">
          AI
        </span>
      </div>
      <p className="mb-6 text-sm text-ink-soft">
        Analyze a sample of your writing once, then reuse that voice across any of your books. Editing a voice updates
        every story that uses it.
      </p>

      <div data-tour="voices-panel">
        <VoicesManager initialProfiles={profiles} />
      </div>
    </main>
  );
}
