"use client";

import { useEffect, useRef, useState } from "react";

export interface EditorInferred {
  genre: string;
  pov: string;
  tense: string;
  tone: string;
  setting: string;
  mainCharacters: { name: string; role: string; description: string }[];
}

interface EditorChapter {
  key: string;
  id?: string;
  title: string;
  description: string;
  outline: string;
}

interface Props {
  storyId: string;
  initialTitle: string;
  initialLogline: string;
  initialInferred: EditorInferred;
  initialChapters: { id: string; title: string; description: string; outline: string }[];
  lengthLabel: string;
}

let keySeq = 0;
const newKey = () => `c${keySeq++}-${Math.round(Math.random() * 1e6)}`;

const field =
  "w-full rounded-lg border border-line bg-field p-2.5 text-sm text-ink outline-none transition focus:border-go";
const label = "block text-xs font-medium text-ink-soft";
const card = "rounded-xl border border-line bg-surface p-5";

/** A textarea that grows to fit its content instead of scrolling. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      style={{ overflow: "hidden", resize: "none" }}
      className={field}
    />
  );
}

export default function BlueprintEditor({
  storyId,
  initialTitle,
  initialLogline,
  initialInferred,
  initialChapters,
  lengthLabel,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [logline, setLogline] = useState(initialLogline);
  const [inferred, setInferred] = useState<EditorInferred>(initialInferred);
  const [chapters, setChapters] = useState<EditorChapter[]>(
    initialChapters.map((c) => ({ key: c.id, ...c })),
  );

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snapshot for Cancel.
  const snapshot = useRef<{
    title: string;
    logline: string;
    inferred: EditorInferred;
    chapters: EditorChapter[];
  } | null>(null);

  function enterEdit() {
    snapshot.current = JSON.parse(JSON.stringify({ title, logline, inferred, chapters }));
    setEditing(true);
    setSaved(false);
    setError(null);
  }

  function cancelEdit() {
    const s = snapshot.current;
    if (s) {
      setTitle(s.title);
      setLogline(s.logline);
      setInferred(s.inferred);
      setChapters(s.chapters);
    }
    setEditing(false);
    setError(null);
  }

  function setInf<K extends keyof EditorInferred>(fieldKey: K, value: EditorInferred[K]) {
    setInferred((p) => ({ ...p, [fieldKey]: value }));
  }
  function setChapter(idx: number, patch: Partial<EditorChapter>) {
    setChapters((p) => p.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function moveChapter(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= chapters.length) return;
    setChapters((p) => {
      const next = [...p];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function addChapter() {
    setChapters((p) => [...p, { key: newKey(), title: "", description: "", outline: "" }]);
  }
  function removeChapter(idx: number) {
    setChapters((p) => p.filter((_, i) => i !== idx));
  }
  function setCharacter(idx: number, patch: Partial<EditorInferred["mainCharacters"][number]>) {
    setInferred((p) => ({
      ...p,
      mainCharacters: p.mainCharacters.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  }
  function addCharacter() {
    setInferred((p) => ({
      ...p,
      mainCharacters: [...p.mainCharacters, { name: "", role: "", description: "" }],
    }));
  }
  function removeCharacter(idx: number) {
    setInferred((p) => ({ ...p, mainCharacters: p.mainCharacters.filter((_, i) => i !== idx) }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          logline,
          inferred,
          chapters: chapters.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            outline: c.outline,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      if (data.inferred) setInferred(data.inferred);
      setChapters(
        (data.chapters as { id: string; title: string; description: string; outline: string }[]).map((c) => ({
          key: c.id,
          ...c,
        })),
      );
      setSaved(true);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header: title + controls */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className={label}>Title</label>
                <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className={label}>Logline</label>
                <AutoTextarea value={logline} onChange={setLogline} />
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">{title || "Untitled"}</h1>
              {logline && <p className="mt-2 text-base text-ink-soft">{logline}</p>}
            </>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            {lengthLabel} · {chapters.length} chapters
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-go px-4 py-2 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={enterEdit}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink transition hover:bg-control-hover"
            >
              <span aria-hidden>✎</span> Edit
            </button>
          )}
        </div>
      </div>

      {saved && !editing && <p className="text-sm font-medium text-green-800">Saved.</p>}
      {error && <p className="text-sm text-red-800">{error}</p>}

      {/* Story details */}
      <section className={card}>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">Story details</h2>

        {editing ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Labeled name="Genre"><input className={field} value={inferred.genre} onChange={(e) => setInf("genre", e.target.value)} /></Labeled>
              <Labeled name="Point of view"><input className={field} value={inferred.pov} onChange={(e) => setInf("pov", e.target.value)} /></Labeled>
              <Labeled name="Tense"><input className={field} value={inferred.tense} onChange={(e) => setInf("tense", e.target.value)} /></Labeled>
              <Labeled name="Tone"><input className={field} value={inferred.tone} onChange={(e) => setInf("tone", e.target.value)} /></Labeled>
              <div className="sm:col-span-2">
                <Labeled name="Setting"><AutoTextarea value={inferred.setting} onChange={(v) => setInf("setting", v)} /></Labeled>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Main characters</h3>
                <button type="button" onClick={addCharacter} className="text-xs text-ink-soft hover:text-ink hover:underline">+ Add character</button>
              </div>
              <div className="space-y-3">
                {inferred.mainCharacters.map((c, i) => (
                  <div key={i} className="rounded-lg border border-line bg-field/60 p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input className={field} placeholder="Name" value={c.name} onChange={(e) => setCharacter(i, { name: e.target.value })} />
                      <input className={field} placeholder="Role" value={c.role} onChange={(e) => setCharacter(i, { role: e.target.value })} />
                    </div>
                    <div className="mt-2">
                      <AutoTextarea value={c.description} onChange={(v) => setCharacter(i, { description: v })} placeholder="Description" />
                    </div>
                    <div className="mt-1 text-right">
                      <button type="button" onClick={() => removeCharacter(i)} className="text-xs text-red-800/80 hover:underline">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <ReadField label="Genre" value={inferred.genre} />
              <ReadField label="Point of view" value={inferred.pov} />
              <ReadField label="Tense" value={inferred.tense} />
              <ReadField label="Tone" value={inferred.tone} />
              <div className="sm:col-span-2">
                <ReadField label="Setting" value={inferred.setting} />
              </div>
            </dl>
            {inferred.mainCharacters.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Main characters</h3>
                <ul className="space-y-2 text-sm">
                  {inferred.mainCharacters.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium text-ink">{c.name}</span>
                      {c.role && <span className="text-ink-soft"> — {c.role}</span>}
                      {c.description && <p className="whitespace-pre-wrap text-ink/85">{c.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Chapters */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Chapters</h2>
        <ol className="space-y-4">
          {chapters.map((ch, i) => (
            <li key={ch.key} className={card}>
              {editing ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-soft">Chapter {i + 1}</span>
                    <div className="flex items-center gap-3 text-xs text-ink">
                      <button type="button" onClick={() => moveChapter(i, -1)} disabled={i === 0} className="disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => moveChapter(i, 1)} disabled={i === chapters.length - 1} className="disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => removeChapter(i)} className="text-red-800/80 hover:underline">Delete</button>
                    </div>
                  </div>
                  <input className={field} placeholder="Chapter title" value={ch.title} onChange={(e) => setChapter(i, { title: e.target.value })} />
                  <div className="mt-2"><AutoTextarea value={ch.description} onChange={(v) => setChapter(i, { description: v })} placeholder="One-line description" /></div>
                  <div className="mt-2"><AutoTextarea value={ch.outline} onChange={(v) => setChapter(i, { outline: v })} placeholder="Detailed outline" /></div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="font-medium text-ink">{ch.title || "Untitled chapter"}</h3>
                  </div>
                  {ch.description && <p className="mt-1 text-sm italic text-ink-soft">{ch.description}</p>}
                  {ch.outline && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{ch.outline}</p>}
                </>
              )}
            </li>
          ))}
        </ol>
        {editing && (
          <button
            type="button"
            onClick={addChapter}
            className="mt-4 w-full rounded-lg border border-dashed border-line py-2.5 text-sm text-ink-soft hover:border-go hover:text-ink"
          >
            + Add chapter
          </button>
        )}
      </section>
    </div>
  );
}

function Labeled({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={label}>{name}</label>
      {children}
    </div>
  );
}

function ReadField({ label: name, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{name}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}
