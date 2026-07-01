"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import ProseChat, { type ChatSelection } from "./ProseChat";
import {
  applyProseEdits,
  joinParagraphs,
  splitParagraphs,
  type ProseChange,
  type ProseProposal,
} from "@/lib/prosePatch";

interface EditorChapter {
  index: number; // real 0-based index (used to save)
  number: number; // 1-based display / URL number
  title: string;
  content: string;
}

interface NavChapter {
  number: number;
  title: string;
}

interface Props {
  storyId: string;
  title: string;
  logline: string | null;
  chapter: EditorChapter;
  chapters: NavChapter[];
  prevNumber: number | null;
  nextNumber: number | null;
  position: number; // 1-based position among readable chapters
  total: number;
  isFirst: boolean;
}

interface Preview {
  paragraphs: string[]; // the chapter after the edits
  changes: ProseChange[];
}

const proseCls = "whitespace-pre-wrap font-reading text-[1.075rem] leading-[1.85] text-ink/90";

export default function BookEditor({
  storyId,
  title,
  logline,
  chapter,
  chapters,
  prevNumber,
  nextNumber,
  position,
  total,
  isFirst,
}: Props) {
  const router = useRouter();
  // Local copy of the chapter's prose so accepted edits show without a reload.
  const [content, setContent] = useState(chapter.content);
  const [selection, setSelection] = useState<ChatSelection | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Manual (type-it-yourself) editing of the whole chapter.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const proseRef = useRef<HTMLDivElement>(null);

  const paragraphs = useMemo(() => splitParagraphs(content), [content]);

  const gotoChapter = (n: number | null) => {
    if (n != null) router.push(`/story/${storyId}/edit/${n}`);
  };

  function paraIdxOf(node: Node | null): number | null {
    let el: Element | null = node instanceof Element ? node : (node?.parentElement ?? null);
    while (el && el !== proseRef.current) {
      const v = el.getAttribute("data-idx");
      if (v != null) return Number(v);
      el = el.parentElement;
    }
    return null;
  }

  function captureSelection() {
    const sel = window.getSelection();
    const container = proseRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !container) return;
    if (!container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) return;
    const a = paraIdxOf(sel.anchorNode);
    const b = paraIdxOf(sel.focusNode);
    const text = sel.toString().trim();
    if (a == null || b == null || !text) return;
    setSelection({ text, fromParagraph: Math.min(a, b) + 1, toParagraph: Math.max(a, b) + 1 });
  }

  function onProposal(proposal: ProseProposal) {
    const { paragraphs: next, changes } = applyProseEdits(paragraphs, proposal.edits);
    setPreview({ paragraphs: next, changes });
    setSaveError(null);
  }

  // Persist the chapter's new content (shared by AI-accept and manual save).
  async function saveContent(next: string) {
    const res = await fetch(`/api/stories/${storyId}/save-chapter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: chapter.index, content: next }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Couldn't save the change.");
    setContent(next);
  }

  async function accept() {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveContent(joinParagraphs(preview.paragraphs));
      setPreview(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setSelection(null);
    setPreview(null);
    setSaveError(null);
    setDraft(content);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveContent(draft);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Top bar: navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <Link href={`/story/${storyId}`} className="text-ink-soft hover:text-ink hover:underline">
            ← Blueprint
          </Link>
          <Link href={`/story/${storyId}/read/${chapter.number}`} className="text-ink-soft hover:text-ink hover:underline">
            Read
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => gotoChapter(prevNumber)}
            disabled={prevNumber == null}
            aria-label="Previous chapter"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-control text-ink transition hover:bg-control-hover disabled:opacity-40"
          >
            ←
          </button>
          <select
            value={chapter.number}
            onChange={(e) => gotoChapter(Number(e.target.value))}
            className="max-w-[16rem] truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink shadow-sm outline-none focus:border-go"
          >
            {chapters.map((c) => (
              <option key={c.number} value={c.number}>
                Chapter {c.number}: {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => gotoChapter(nextNumber)}
            disabled={nextNumber == null}
            aria-label="Next chapter"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-control text-ink transition hover:bg-control-hover disabled:opacity-40"
          >
            →
          </button>
          <span className="ml-1 tabular-nums text-ink-soft">
            {position} / {total}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface px-6 py-12 shadow-card sm:px-14 sm:py-16">
          {isFirst && (
            <header className="mb-10 text-center">
              <p className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title || "Untitled"}</p>
              {logline && (
                <p className="mx-auto mt-3 max-w-xl font-reading text-base italic text-ink-soft">{logline}</p>
              )}
            </header>
          )}

          <header className="mb-7 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Chapter {chapter.number}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{chapter.title}</h2>
          </header>

          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={24}
                autoFocus
                className="w-full resize-y rounded-lg border border-line bg-field p-4 font-reading text-[1.075rem] leading-[1.85] text-ink outline-none transition focus:border-go"
              />
              {saveError && <p className="mt-2 text-sm text-red-800">{saveError}</p>}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="rounded-lg border border-line bg-control px-3 py-1.5 text-sm text-ink transition hover:bg-control-hover disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-lg bg-go px-4 py-1.5 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : preview ? (
            <PreviewPanel
              preview={preview}
              saving={saving}
              error={saveError}
              onAccept={accept}
              onDiscard={() => setPreview(null)}
            />
          ) : (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-control"
                >
                  Edit text
                </button>
              </div>
              <div ref={proseRef} onMouseUp={captureSelection} className="space-y-[1.1em]">
                {paragraphs.length === 0 ? (
                  <p className="text-ink-soft">This chapter has no prose yet.</p>
                ) : (
                  paragraphs.map((p, i) => (
                    <p key={i} data-idx={i} className={proseCls}>
                      {p}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ProseChat
        storyId={storyId}
        chapterIndex={chapter.index}
        chapterNumber={chapter.number}
        selection={selection}
        onClearSelection={() => setSelection(null)}
        onProposal={onProposal}
      />
    </div>
  );
}

// ---- Preview (before/after) -------------------------------------------------

function PreviewPanel({
  preview,
  saving,
  error,
  onAccept,
  onDiscard,
}: {
  preview: Preview;
  saving: boolean;
  error: string | null;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-field/50 px-4 py-3">
        <p className="text-sm text-ink-soft">
          {preview.changes.length} paragraph{preview.changes.length === 1 ? "" : "s"} changed — review before saving.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded-lg border border-line bg-control px-3 py-1.5 text-sm text-ink transition hover:bg-control-hover disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={saving}
            className="rounded-lg bg-go px-4 py-1.5 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Accept changes"}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-800">{error}</p>}

      <div className="space-y-5">
        {preview.changes.map((ch, i) => (
          <div key={i} className="space-y-2">
            {ch.before != null && (
              <p className={`${proseCls} rounded-md bg-red-50 px-3 py-2 text-red-900/80 line-through decoration-red-400`}>
                {ch.before}
              </p>
            )}
            {ch.after != null && (
              <p className={`${proseCls} rounded-md bg-emerald-50 px-3 py-2 text-emerald-950`}>{ch.after}</p>
            )}
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">
              {ch.op === "replace" ? "Rewritten" : ch.op === "insert" ? "Added" : "Removed"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
