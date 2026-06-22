"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const KEY_STORAGE = "ai-author:apiKey";

interface Props {
  storyId: string;
  total: number;
  written: number;
}

export default function GenerationPanel({ storyId, total, written: initialWritten }: Props) {
  const router = useRouter();
  const [written, setWritten] = useState(initialWritten);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function genOne(): Promise<{ done: boolean; written: number }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) : null;
    if (key) headers["x-llm-key"] = key;
    const res = await fetch(`/api/stories/${storyId}/generate-next`, { method: "POST", headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Generation failed.");
    return data;
  }

  async function generateNext() {
    setBusy(true);
    setError(null);
    try {
      setStatus(`Writing chapter ${written + 1} of ${total}… (a minute or two)`);
      const data = await genOne();
      setWritten(data.written);
      router.refresh();
      setStatus(data.done ? "All chapters written." : `Wrote chapter ${data.written} of ${total}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function generateAll() {
    setBusy(true);
    setError(null);
    try {
      let w = written;
      let done = w >= total;
      while (!done) {
        setStatus(`Writing chapter ${w + 1} of ${total}… (keep this tab open)`);
        const data = await genOne();
        w = data.written;
        done = data.done;
        setWritten(w);
        router.refresh();
      }
      setStatus("All chapters written.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  const pct = total ? Math.round((written / total) * 100) : 0;
  const allDone = written >= total && total > 0;

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Generation</h2>
          <p className="text-xs text-ink-soft">
            {written} of {total} chapters written
          </p>
        </div>
        {written > 0 && (
          <Link
            href={`/story/${storyId}/read`}
            className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover"
          >
            Read book →
          </Link>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-control">
        <div className="h-full rounded-full bg-go transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generateNext}
          disabled={busy || allDone}
          className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
        >
          {busy ? "Writing…" : allDone ? "All chapters written" : "Write next chapter"}
        </button>
        {!allDone && (
          <button
            type="button"
            onClick={generateAll}
            disabled={busy}
            className="rounded-lg border border-line bg-control px-4 py-2 text-sm text-ink transition hover:bg-control-hover disabled:opacity-50"
          >
            Auto-write all
          </button>
        )}
      </div>

      {status && <p className="mt-3 text-sm text-ink-soft">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
    </section>
  );
}
