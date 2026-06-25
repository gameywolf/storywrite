"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const KEY_STORAGE = "ai-author:apiKey";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  storyId: string;
}

export default function BlueprintChat({ storyId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // History at/after this index is the "active topic" — only these turns are fed
  // back to the AI. Marking a topic solved bumps it to the end, so the next
  // message starts fresh (earlier turns stay visible but aren't re-sent).
  const [contextStart, setContextStart] = useState(0);
  // Message indices where a fresh topic begins (render a divider before them).
  const [boundaries, setBoundaries] = useState<number[]>([]);
  // Show the "Did that solve it?" prompt under the latest assistant reply.
  const [askFeedback, setAskFeedback] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setAskFeedback(false);
    setBusy(true);
    const history = messages.slice(contextStart); // only the active topic
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    scrollToEnd();

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const key = typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) : null;
      if (key) headers["x-llm-key"] = key;

      const res = await fetch(`/api/stories/${storyId}/blueprint-chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setAskFeedback(true);
      // Reload server data so the blueprint editor remounts with the revision.
      router.refresh();
      scrollToEnd();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
      // Drop the optimistic user message back into the box so it isn't lost.
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  // "Yes, solved" — close out this topic. Keep it on screen, but don't feed it
  // into future prompts.
  function markSolved() {
    const at = messages.length;
    setBoundaries((b) => [...b, at]);
    setContextStart(at);
    setAskFeedback(false);
  }

  // "No" — keep going on the same topic; history will still be sent next time.
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
        aria-label="Adjust the blueprint with AI"
        className={`fixed bottom-6 right-6 z-30 h-14 w-14 items-center justify-center rounded-full bg-ai text-ai-ink shadow-lg transition hover:bg-ai-hover ${
          open ? "hidden" : "flex"
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
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
          <div>
            <h2 className="text-sm font-semibold text-ink">Adjust with AI</h2>
            <p className="text-xs text-ink-soft">
              Tweak chapters, characters, tone, or length.
            </p>
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
            <p className="text-sm text-ink-soft">
              Tell the AI how to change the blueprint — e.g. “Make chapter 3 darker,” or “Cut this
              down to 8 chapters.”
            </p>
          )}

          {messages.map((m, i) => (
            <div key={i}>
              {boundaries.includes(i) && (
                <div className="my-3 flex items-center gap-2 text-[11px] text-ink-soft">
                  <span className="h-px flex-1 bg-line" />
                  New topic — earlier chat not sent to the AI
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
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

          {busy && <p className="text-sm text-ink-soft">Revising the blueprint…</p>}

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

        {/* Composer */}
        <div className="shrink-0 border-t border-line p-4">
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
          <p className="mt-2 text-[11px] text-ink-soft">
            {contextStart < messages.length
              ? "The AI sees this topic's messages so it can keep context."
              : "Starting a fresh topic — earlier chat won't be sent to the AI."}
          </p>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </aside>
    </>
  );
}
