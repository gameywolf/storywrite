"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Ghost from "./Ghost";
import type { ProseProposal } from "@/lib/prosePatch";

const KEY_STORAGE = "ai-author:apiKey";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSelection {
  text: string;
  fromParagraph: number;
  toParagraph: number;
}

interface Props {
  storyId: string;
  /** Real 0-based index of the chapter currently on the page. */
  chapterIndex: number;
  chapterNumber: number;
  /** A highlighted passage to scope the edit to, or null for the whole chapter. */
  selection: ChatSelection | null;
  onClearSelection: () => void;
  /** Called with a fresh proposal so the editor can show a before/after preview. */
  onProposal: (proposal: ProseProposal) => void;
}

export default function ProseChat({
  storyId,
  chapterIndex,
  chapterNumber,
  selection,
  onClearSelection,
  onProposal,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // History at/after this index is the "active topic" — only these turns are fed
  // back to the AI (same convention as the blueprint chat).
  const [contextStart, setContextStart] = useState(0);
  const [boundaries, setBoundaries] = useState<number[]>([]);
  const [askFeedback, setAskFeedback] = useState(false);
  // A pending blueprint instruction the AI suggested; "" when none.
  const [blueprintInstruction, setBlueprintInstruction] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  function keyHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) : null;
    if (key) headers["x-llm-key"] = key;
    return headers;
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setAskFeedback(false);
    setBlueprintInstruction("");
    setBusy(true);
    const history = messages.slice(contextStart); // only the active topic
    const scoped = selection; // capture before it's cleared
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    scrollToEnd();

    try {
      const res = await fetch(`/api/stories/${storyId}/revise-prose`, {
        method: "POST",
        headers: keyHeaders(),
        body: JSON.stringify({
          message: text,
          history,
          chapterIndex,
          selection: scoped,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      const proposal = data as ProseProposal;
      setMessages((m) => [...m, { role: "assistant", content: proposal.reply }]);
      setAskFeedback(true);
      if (proposal.blueprintInstruction) setBlueprintInstruction(proposal.blueprintInstruction);
      // Hand the edits to the editor for a before/after preview. Only when the AI
      // actually proposed changes (a bare clarifying question has no edits).
      if (proposal.edits.length > 0) {
        onProposal(proposal);
        onClearSelection();
      }
      scrollToEnd();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  async function updateBlueprint() {
    const instruction = blueprintInstruction;
    if (!instruction || busy) return;
    setBlueprintInstruction("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/blueprint-chat`, {
        method: "POST",
        headers: keyHeaders(),
        body: JSON.stringify({ message: instruction, history: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update the blueprint.");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "I've updated the blueprint to match." },
      ]);
      router.refresh();
      scrollToEnd();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  function markSolved() {
    const at = messages.length;
    setBoundaries((b) => [...b, at]);
    setContextStart(at);
    setAskFeedback(false);
  }

  function keepGoing() {
    setAskFeedback(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <>
      {/* Floating button — bottom right */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat with Penghost"
        className={`group fixed bottom-6 right-6 z-30 h-14 w-14 items-center justify-center rounded-full border border-line bg-white shadow-lg transition hover:bg-ai-soft ${
          open ? "hidden" : "flex"
        }`}
      >
        <Ghost size={30} className="text-ai transition-transform group-hover:-translate-y-0.5" />
      </button>

      {/* Right sidebar / drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-line bg-surface shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-4">
          <div className="flex items-center gap-2.5">
            <Ghost size={32} className="shrink-0 text-ai" />
            <div>
              <h2 className="font-serif text-base font-semibold text-ink">Pen<span className="text-ai">ghost</span></h2>
              <p className="text-xs text-ink-soft">Your ghostwriter — revise the prose of this chapter.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-lg leading-none text-ink-soft transition hover:bg-control hover:text-ink"
          >
            ×
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex items-start gap-2">
              <Ghost size={26} floating className="mt-0.5 shrink-0 text-ai" />
              <p className="text-sm text-ink-soft">
                Hi, I&apos;m Penghost. Tell me how to change the writing — e.g. “Make this scene
                tenser,” or highlight a passage and say “tighten this.”
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i}>
              {boundaries.includes(i) && (
                <div className="my-3 flex items-center gap-2 text-[11px] text-ink-soft">
                  <span className="h-px flex-1 bg-line" />
                  New topic — earlier chat not sent to Penghost
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div className={m.role === "user" ? "flex justify-end" : "flex justify-start gap-2"}>
                {m.role === "assistant" && <Ghost size={22} className="mt-0.5 shrink-0 text-ai" />}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-lg bg-go px-3 py-2 text-sm text-go-ink"
                      : "max-w-[85%] rounded-lg border border-line bg-field/50 px-3 py-2 text-sm text-ink"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            </div>
          ))}

          {busy && (
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <Ghost size={20} floating className="shrink-0 text-ai" />
              Revising the prose…
            </p>
          )}

          {blueprintInstruction && !busy && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ai/40 bg-ai-soft/40 px-3 py-2 text-sm">
              <span className="text-ink-soft">This change may leave the blueprint out of date. Update it too?</span>
              <button
                type="button"
                onClick={updateBlueprint}
                className="rounded-md bg-go px-2.5 py-1 text-xs font-semibold text-go-ink transition hover:bg-go-hover"
              >
                Yes, update blueprint
              </button>
              <button
                type="button"
                onClick={() => setBlueprintInstruction("")}
                className="rounded-md border border-line bg-control px-2.5 py-1 text-xs text-ink transition hover:bg-control-hover"
              >
                No
              </button>
            </div>
          )}

          {askFeedback && !busy && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-field/50 px-3 py-2 text-sm">
              <span className="text-ink-soft">Did that solve it?</span>
              <button
                type="button"
                onClick={markSolved}
                className="rounded-md bg-go px-2.5 py-1 text-xs font-semibold text-go-ink transition hover:bg-go-hover"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={keepGoing}
                className="rounded-md border border-line bg-control px-2.5 py-1 text-xs text-ink transition hover:bg-control-hover"
              >
                No, keep refining
              </button>
            </div>
          )}
        </div>

        {/* Scope indicator */}
        <div className="shrink-0 border-t border-line px-4 pt-3 text-[11px]">
          {selection ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-ai-soft/50 px-2.5 py-1.5 text-ink">
              <span className="truncate">
                Editing highlighted passage — “{selection.text.slice(0, 60)}
                {selection.text.length > 60 ? "…" : ""}”
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Clear selection"
                className="shrink-0 rounded px-1 leading-none text-ink-soft transition hover:text-ink"
              >
                ×
              </button>
            </div>
          ) : (
            <p className="text-ink-soft">Editing all of Chapter {chapterNumber}. Highlight text to scope a change.</p>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 p-4 pt-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Ask for a change…"
              className="w-full resize-none rounded-lg border border-line bg-field p-2.5 text-sm text-ink outline-none transition focus:border-go"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-lg bg-go px-4 py-2.5 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </aside>
    </>
  );
}
