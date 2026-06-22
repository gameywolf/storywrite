"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VoiceAnalysis } from "@/lib/voice";

const KEY_STORAGE = "ai-author:apiKey";

export interface PickerProfile {
  id: string;
  name: string;
}

interface Props {
  storyId: string;
  profiles: PickerProfile[];
  selectedId: string | null;
  selectedAnalysis: VoiceAnalysis | null;
}

const fieldCls =
  "w-full rounded-lg border border-line bg-field p-2.5 text-sm text-ink outline-none transition focus:border-go";

function authHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) : null;
  if (key) headers["x-llm-key"] = key;
  return headers;
}

export default function VoiceProfilePicker({ storyId, profiles, selectedId, selectedAnalysis }: Props) {
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [sample, setSample] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function linkProfile(voiceProfileId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceProfileId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to set voice.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createAndSelect() {
    if (sample.trim().length < 100) {
      setError("Paste a longer sample (at least a paragraph or two).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/voice-profiles", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ sample, name: newName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Voice analysis failed.");
      // Saved to the library; now link it to this story.
      const link = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceProfileId: data.id }),
      });
      if (!link.ok) {
        const ld = await link.json();
        throw new Error(ld.error ?? "Saved the voice, but failed to apply it.");
      }
      setSample("");
      setNewName("");
      setAdding(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          Voice
          <span className="rounded bg-ai-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-ink">
            AI
          </span>
        </h2>
        {selectedId ? (
          <span className="text-xs font-medium text-go">✓ Voice set</span>
        ) : (
          <span className="text-xs text-ink-soft">Default</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={selectedId ?? ""}
          disabled={busy}
          onChange={(e) => linkProfile(e.target.value || null)}
          className="rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-go disabled:opacity-50"
        >
          <option value="">Default voice</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setError(null); }}
            className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover"
          >
            + New from sample
          </button>
        )}
        <Link href="/voices" className="text-xs text-ink-soft hover:text-ink hover:underline">
          Manage voices →
        </Link>
      </div>

      {/* Selected profile preview */}
      {!adding && selectedAnalysis?.summary && (
        <p className="mt-3 text-sm text-ink/85">{selectedAnalysis.summary}</p>
      )}

      {/* Add new from sample (saved to the library and selected here) */}
      {adding && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-ink-soft">
            Paste a sample of your writing. It&apos;s analyzed into a reusable voice, saved to your library, and applied
            to this story.
          </p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. “My literary voice”)"
            className={fieldCls}
          />
          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            rows={6}
            placeholder="Paste a few hundred words of your writing — fiction works best…"
            className={`${fieldCls} mt-2`}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={createAndSelect}
              disabled={busy}
              className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
            >
              {busy ? "Analyzing…" : "Analyze & use"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null); setSample(""); setNewName(""); }}
              className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        Chapters are written to match this voice. Story details and a chapter&apos;s summary override it when they
        conflict (e.g. perspective).
      </p>

      {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
    </section>
  );
}
