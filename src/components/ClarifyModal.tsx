"use client";

import { useState } from "react";
import type { ClarifyQuestion } from "@/lib/clarify";
import type { ClarifyAnswer } from "@/lib/prompts/blueprint";

// Overlay that asks the writer to resolve the biggest gaps in their idea before
// the blueprint is generated. Each question is single-select among the model's
// options, plus an always-present free-text "Other" field. Answers are optional
// — the writer can skip the whole thing or leave any question blank.

interface Pick {
  choice: string | null;
  other: string;
}

function effectiveAnswer(p: Pick | undefined): string {
  if (!p) return "";
  return p.other.trim() || p.choice || "";
}

export default function ClarifyModal({
  questions,
  busy,
  error,
  onGenerate,
  onSkip,
  onClose,
}: {
  questions: ClarifyQuestion[];
  busy: boolean;
  error: string | null;
  onGenerate: (answers: ClarifyAnswer[]) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<Record<number, Pick>>({});

  function choose(qi: number, option: string) {
    setPicks((p) => {
      const cur = p[qi];
      // Toggle off if re-clicking the selected tile.
      const choice = cur?.choice === option ? null : option;
      return { ...p, [qi]: { choice, other: "" } };
    });
  }

  function setOther(qi: number, value: string) {
    // Typing your own answer clears any selected tile (mutual exclusion).
    setPicks((p) => ({ ...p, [qi]: { choice: null, other: value } }));
  }

  function collect(): ClarifyAnswer[] {
    return questions
      .map((q, i) => ({ question: q.question, answer: effectiveAnswer(picks[i]) }))
      .filter((a) => a.answer.trim().length > 0);
  }

  const answeredCount = questions.filter((_, i) => effectiveAnswer(picks[i]).trim()).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Refine your story idea"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              Help me fill the gaps
              <span className="rounded bg-ai-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-ink">
                AI
              </span>
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Your idea leaves a few things open. Answer what you have an opinion on — skip the rest.
              Anything you don&apos;t answer, the AI decides.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-ink-soft transition hover:bg-control hover:text-ink disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Questions */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {questions.map((q, qi) => {
            const pick = picks[qi];
            return (
              <div key={qi}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-ai-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-ink">
                    {q.topic}
                  </span>
                </div>
                <p className="mb-3 text-sm font-medium text-ink">{q.question}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const selected = pick?.choice === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => choose(qi, opt)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          selected
                            ? "border-ai bg-ai-soft text-ai-ink"
                            : "border-line bg-field text-ink hover:border-ai/50"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={pick?.other ?? ""}
                  onChange={(e) => setOther(qi, e.target.value)}
                  placeholder="Or type your own answer…"
                  className="mt-2 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-ai"
                />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-6 py-4">
          {error && (
            <p className="mb-3 rounded-lg border border-red-700/20 bg-red-700/10 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="text-sm font-medium text-ink-soft underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-50"
            >
              Skip &amp; generate
            </button>
            <button
              type="button"
              onClick={() => onGenerate(collect())}
              disabled={busy}
              className="rounded-lg bg-go px-5 py-2.5 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
            >
              {busy
                ? "Planning your story…"
                : `Generate blueprint${answeredCount ? ` (${answeredCount} answered)` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
