"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VoiceAnalysis } from "@/lib/voice";
import { VOICE_FIELDS, EMPTY_ANALYSIS } from "@/lib/voiceFields";

const KEY_STORAGE = "ai-author:apiKey";

export interface ProfileListItem {
  id: string;
  name: string;
  analysis: VoiceAnalysis;
  hasSample: boolean;
  storyCount: number;
}

const fieldCls =
  "w-full rounded-lg border border-line bg-field p-2.5 text-sm text-ink outline-none transition focus:border-go";

function authHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) : null;
  if (key) headers["x-llm-key"] = key;
  return headers;
}

export default function VoicesManager({ initialProfiles }: { initialProfiles: ProfileListItem[] }) {
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [sample, setSample] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draft, setDraft] = useState<VoiceAnalysis>(EMPTY_ANALYSIS);

  async function createProfile() {
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
      setSample("");
      setNewName("");
      setCreating(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: ProfileListItem) {
    setEditingId(p.id);
    setDraftName(p.name);
    setDraft({ ...EMPTY_ANALYSIS, ...p.analysis });
    setError(null);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName.trim(), analysis: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProfile(p: ProfileListItem) {
    const msg =
      p.storyCount > 0
        ? `Delete "${p.name}"? ${p.storyCount} ${p.storyCount === 1 ? "story" : "stories"} will fall back to the default voice.`
        : `Delete "${p.name}"?`;
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice-profiles/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Create */}
      {creating ? (
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h3 className="text-sm font-semibold text-ink">New voice</h3>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. “My literary voice”)"
            className={`${fieldCls} mt-3`}
          />
          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            rows={7}
            placeholder="Paste a few hundred words of your writing — fiction works best…"
            className={`${fieldCls} mt-2`}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={createProfile}
              disabled={busy}
              className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
            >
              {busy ? "Analyzing…" : "Analyze & save"}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(null); setSample(""); setNewName(""); }}
              className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => { setCreating(true); setError(null); }}
          className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover"
        >
          + New voice
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-800">{error}</p>}

      {/* List */}
      <ul className="mt-6 space-y-3">
        {initialProfiles.length === 0 && !creating && (
          <li className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-ink-soft">
            No voices yet. Add one to reuse your writing style across books.
          </li>
        )}

        {initialProfiles.map((p) => (
          <li key={p.id} className="rounded-xl border border-line bg-surface p-5 shadow-card">
            {editingId === p.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-soft">Name</label>
                  <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className={fieldCls} />
                </div>
                {VOICE_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-ink-soft">{f.label}</label>
                    <textarea
                      value={draft[f.key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      rows={f.rows}
                      className={fieldCls}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(p.id)}
                    disabled={busy}
                    className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setError(null); }}
                    className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold text-ink">{p.name}</h3>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {p.storyCount} {p.storyCount === 1 ? "story" : "stories"}
                  </span>
                </div>
                {p.analysis?.summary && <p className="mt-1 text-sm text-ink/85">{p.analysis.summary}</p>}
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                  {VOICE_FIELDS.filter((f) => f.key !== "summary" && p.analysis?.[f.key]).map((f) => (
                    <div key={f.key}>
                      <dt className="text-ink-soft">{f.label}</dt>
                      <dd className="text-ink/85">{p.analysis[f.key]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProfile(p)}
                    disabled={busy}
                    className="rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:text-ink disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
