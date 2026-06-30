"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Ghost from "./Ghost";

const TOUR_KEY = "penghost:tour-done";

type Advance = "next" | { to: (pathname: string) => boolean };

interface Step {
  key: string;
  onPage: (pathname: string) => boolean; // which page this step belongs to
  target?: string; // data-tour value to spotlight (omit → centered card)
  title: string;
  body: string;
  advance: Advance; // "next" button, or wait for a navigation the user performs
  last?: boolean;
}

const isStory = (p: string) => p.startsWith("/story/") && !p.endsWith("/read");

// The walkthrough. Section hops are taught through the header: the step points
// at the nav link and waits for the user to click it (no auto-navigation).
const STEPS: Step[] = [
  {
    key: "welcome",
    onPage: () => true,
    title: "Boo! I'm Penghost 👻",
    body: "Your ghostwriter. Quick tour? I'll point at things — you do the clicking.",
    advance: "next",
  },
  {
    key: "describe",
    onPage: (p) => p === "/",
    target: "describe",
    title: "1 · Describe your story",
    body: "Type your idea here and I'll plan it into a chapter-by-chapter blueprint.",
    advance: "next",
  },
  {
    key: "go-voices",
    onPage: (p) => p === "/",
    target: "nav-voices",
    title: "Get around from the header",
    body: "Your writing voice is set under Voices. Click it up here to head over — that's how you move around.",
    advance: { to: (p) => p.startsWith("/voices") },
  },
  {
    key: "voices",
    onPage: (p) => p.startsWith("/voices"),
    target: "voices-panel",
    title: "2 · Teach me your voice",
    body: "Add a sample of your writing and I'll match your style in every chapter.",
    advance: "next",
  },
  {
    key: "go-stories",
    onPage: (p) => p.startsWith("/voices"),
    target: "nav-stories",
    title: "Your library",
    body: "Now click Stories in the header to see every book you're working on.",
    advance: { to: (p) => p === "/stories" || isStory(p) },
  },
  {
    key: "stories",
    onPage: (p) => p === "/stories",
    target: "stories-list",
    title: "3 · Your stories",
    body: "Each book lives here. Open one to edit its blueprint and write chapters.",
    advance: { to: isStory },
  },
  {
    key: "blueprint",
    onPage: isStory,
    target: "blueprint",
    title: "4 · Edit the blueprint",
    body: "Expand any chapter to read it, or hit Edit to rewrite details, reorder, or add chapters. Want bigger changes? Tap me in the bottom-right corner and just ask.",
    advance: "next",
  },
  {
    key: "generation",
    onPage: isStory,
    target: "generation",
    title: "5 · Write & set the voice",
    body: "Generate chapters one at a time or auto-write the whole book here — and pick which voice I use.",
    advance: "next",
  },
  {
    key: "read",
    onPage: isStory,
    target: "read",
    title: "6 · Read your story",
    body: "Once chapters are written, the Read button opens your finished book. That's the whole loop — happy writing!",
    advance: "next",
    last: true,
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export default function GhostTour() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const lastRect = useRef<Rect | null>(null);

  const step = STEPS[stepIdx];

  // Auto-start once for first-time visitors, a beat after load. Reading
  // localStorage inside the timer keeps setState out of the effect body.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => {
      if (window.location.pathname !== "/") router.push("/"); // normalize the start
      setActive(true);
    }, 700);
    return () => clearTimeout(t);
  }, [router]);

  // Advance when the user navigates to where a "click the header" step points.
  useEffect(() => {
    if (!active || !step || step.advance === "next") return;
    if (step.advance.to(pathname)) {
      const id = requestAnimationFrame(() => setStepIdx((i) => (i === stepIdx ? i + 1 : i)));
      return () => cancelAnimationFrame(id);
    }
  }, [pathname, active, step, stepIdx]);

  // Track the spotlighted element's position (follows scroll/layout shifts).
  // All state updates happen inside the rAF loop, never synchronously in the
  // effect body, so re-running on step/page change can't cascade renders.
  useEffect(() => {
    if (!active) return;
    lastRect.current = null;
    let raf = 0;
    let scrolled = false;
    const set = (next: Rect | null) => {
      const prev = lastRect.current;
      const same =
        (prev === null && next === null) ||
        (prev && next && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height);
      if (!same) {
        lastRect.current = next;
        setRect(next);
      }
    };
    const tick = () => {
      const want = step?.target && step.onPage(pathname);
      const el = want ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        set({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        set(null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, step, pathname]);

  function finish() {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // private mode etc. — ignore
    }
    setActive(false);
    setStepIdx(0);
  }

  if (!active || !step) return null;

  const waitingForClick = step.advance !== "next";
  const canGoBack = stepIdx > 0 && STEPS[stepIdx - 1].onPage(pathname);
  const spotlight = rect
    ? { top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }
    : null;

  // Card placement: anchored under/over the spotlight, or centered as fallback.
  let cardStyle: React.CSSProperties;
  if (spotlight && typeof window !== "undefined") {
    const below = spotlight.top + spotlight.height < window.innerHeight * 0.55;
    const left = clamp(spotlight.left, 12, window.innerWidth - 332);
    cardStyle = below
      ? { top: spotlight.top + spotlight.height + 12, left }
      : { top: spotlight.top - 12, left, transform: "translateY(-100%)" };
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <>
      {/* Dimming + spotlight */}
      {spotlight ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 transition-all duration-150"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(28, 22, 12, 0.66)",
            outline: "2px solid var(--color-ai)",
            outlineOffset: 2,
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-50" style={{ background: "rgba(28, 22, 12, 0.66)" }} />
      )}

      {/* Ghost speech card */}
      <div style={cardStyle} className="fixed z-[51] w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface p-4 shadow-card">
        <button
          type="button"
          onClick={finish}
          aria-label="Dismiss tour"
          className="absolute right-2 top-2 rounded-md px-1.5 text-ink-soft transition hover:bg-control hover:text-ink"
        >
          ×
        </button>

        <div className="flex items-start gap-2.5">
          <Ghost size={34} floating className="shrink-0 text-ai" />
          <div className="min-w-0">
            <h2 className="pr-5 text-sm font-semibold text-ink">{step.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === stepIdx ? "w-4 bg-ai" : "w-1.5 bg-line"}`} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                type="button"
                onClick={() => setStepIdx((i) => i - 1)}
                className="rounded-lg border border-line bg-control px-3 py-1.5 text-xs text-ink transition hover:bg-control-hover"
              >
                Back
              </button>
            )}
            {waitingForClick ? (
              <span className="text-xs font-medium text-ai">Click the highlight ↑</span>
            ) : step.last ? (
              <button
                type="button"
                onClick={finish}
                className="rounded-lg bg-go px-3.5 py-1.5 text-xs font-semibold text-go-ink shadow-sm transition hover:bg-go-hover"
              >
                Got it
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIdx((i) => i + 1)}
                className="rounded-lg bg-go px-3.5 py-1.5 text-xs font-semibold text-go-ink shadow-sm transition hover:bg-go-hover"
              >
                Next
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={finish}
          className="mt-2 text-[11px] text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          Skip tour
        </button>
      </div>
    </>
  );
}
