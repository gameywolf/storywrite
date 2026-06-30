"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Chapter {
  number: number;
  title: string;
  content: string;
}

interface Props {
  storyId: string;
  title: string;
  logline: string | null;
  chapters: Chapter[];
}

type Mode = "scroll" | "pages";

export default function BookReader({ storyId, title, logline, chapters }: Props) {
  const [mode, setMode] = useState<Mode>("scroll");

  const segBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 font-medium transition ${
      active ? "bg-go text-go-ink shadow-sm" : "text-ink-soft hover:text-ink"
    }`;

  return (
    <div>
      {/* Top bar: back link + format toggle */}
      <div className="flex items-center justify-between gap-3">
        <Link href={`/story/${storyId}`} className="text-sm text-ink-soft hover:text-ink hover:underline">
          ← Back to blueprint
        </Link>
        {chapters.length > 0 && (
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm shadow-sm">
            <button type="button" onClick={() => setMode("scroll")} className={segBtn(mode === "scroll")}>
              Scroll
            </button>
            <button type="button" onClick={() => setMode("pages")} className={segBtn(mode === "pages")}>
              Pages
            </button>
          </div>
        )}
      </div>

      <div className="mt-5">
        {chapters.length === 0 ? (
          <p className="text-ink-soft">No chapters written yet. Generate some from the blueprint page.</p>
        ) : mode === "scroll" ? (
          <ScrollView title={title} logline={logline} chapters={chapters} />
        ) : (
          <PagesView title={title} logline={logline} chapters={chapters} />
        )}
      </div>
    </div>
  );
}

// ---- Title / chapter heading (shared by both modes) -------------------------

function BookTitle({ title, logline }: { title: string; logline: string | null }) {
  return (
    <header className="mb-14 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title || "Untitled"}</h1>
      {logline && <p className="mx-auto mt-4 max-w-xl font-reading text-lg italic text-ink-soft">{logline}</p>}
      <div aria-hidden className="mx-auto mt-6 flex items-center justify-center gap-3 text-ai">
        <span className="h-px w-12 bg-line" />
        <span className="text-sm">❦</span>
        <span className="h-px w-12 bg-line" />
      </div>
    </header>
  );
}

function ChapterHeading({ number, title }: { number: number; title: string }) {
  return (
    <header className="mb-7 text-center" style={{ breakInside: "avoid", breakAfter: "avoid" }}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Chapter {number}</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">{title}</h2>
    </header>
  );
}

const proseCls = "whitespace-pre-wrap font-reading text-[1.075rem] leading-[1.85] text-ink/90";

// ---- Continuous scroll ------------------------------------------------------

function ScrollView({ title, logline, chapters }: Omit<Props, "storyId">) {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface px-6 py-12 shadow-card sm:px-14 sm:py-16">
      <BookTitle title={title} logline={logline} />
      <div className="space-y-16">
        {chapters.map((c, i) => (
          <article key={c.number}>
            <ChapterHeading number={c.number} title={c.title} />
            <div className={proseCls}>{c.content}</div>
            {i < chapters.length - 1 && <div aria-hidden className="mt-16 text-center text-ai/70">❦</div>}
          </article>
        ))}
      </div>
    </div>
  );
}

// ---- Paginated "book" -------------------------------------------------------

const MARGIN = 40; // per-side text margin within a page, in px
const TWO_PAGE_MIN = 1024; // window width (px) at/above which we show a spread

function PagesView({ title, logline, chapters }: Omit<Props, "storyId">) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0); // viewport width = one spread
  const [perView, setPerView] = useState(1); // pages shown at once (1 or 2)
  const [pageCount, setPageCount] = useState(1); // total pages (columns)
  const [spread, setSpread] = useState(0); // current spread index

  const spreadCount = Math.max(1, Math.ceil(pageCount / perView));

  // perView is decided by the window (not the viewport, which depends on
  // perView via maxWidth — that would loop). viewW measures the actual frame.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const update = () =>
      requestAnimationFrame(() => {
        setPerView(window.innerWidth >= TWO_PAGE_MIN ? 2 : 1);
        setViewW(vp.clientWidth);
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(vp);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Once columns are applied, count them (one per page) from the scroll width.
  useEffect(() => {
    if (!viewW) return;
    const fl = flowRef.current;
    if (!fl) return;
    const id = requestAnimationFrame(() => {
      const colSlot = viewW / perView; // width of one page incl. its gutter
      const count = Math.max(1, Math.round(fl.scrollWidth / colSlot));
      setPageCount(count);
      setSpread((s) => Math.min(s, Math.ceil(count / perView) - 1));
    });
    return () => cancelAnimationFrame(id);
  }, [viewW, perView, chapters]);

  const go = (dir: 1 | -1) => setSpread((s) => Math.min(spreadCount - 1, Math.max(0, s + dir)));

  // Arrow-key paging.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setSpread((s) => Math.max(0, s - 1));
      else if (e.key === "ArrowRight") setSpread((s) => Math.min(spreadCount - 1, s + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spreadCount]);

  // One page slot = viewW / perView, so a spread is exactly one viewport-width
  // translate. Each column is that slot minus its two margins; the column-gap
  // (two facing margins) lands in the spine, so each page reads as its own
  // column on the one connected sheet.
  const colStyle: React.CSSProperties = viewW
    ? {
        columnWidth: `${viewW / perView - 2 * MARGIN}px`,
        columnGap: `${2 * MARGIN}px`,
        columnFill: "auto",
      }
    : {};

  const firstPage = spread * perView + 1;
  const lastPage = Math.min((spread + 1) * perView, pageCount);
  const label =
    lastPage > firstPage ? `Pages ${firstPage}–${lastPage} of ${pageCount}` : `Page ${firstPage} of ${pageCount}`;

  return (
    <div className="flex flex-col items-center">
      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden"
        style={{ height: "min(74vh, 780px)", maxWidth: perView === 2 ? "64rem" : "44rem" }}
      >
        {/* One connected sheet (open book) */}
        <div aria-hidden className="absolute inset-0 rounded-2xl border border-line bg-surface shadow-card" />

        {/* Center spine shadow on a spread */}
        {perView === 2 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2"
            style={{
              width: 2 * MARGIN,
              background:
                "linear-gradient(to right, transparent, rgba(60,45,25,0.05) 35%, rgba(60,45,25,0.13) 50%, rgba(60,45,25,0.05) 65%, transparent)",
            }}
          />
        )}

        {/* Text — page changes are instant; the flip overlay sells the turn */}
        <div
          ref={flowRef}
          className="absolute inset-0"
          style={{ ...colStyle, padding: MARGIN, transform: `translateX(-${spread * viewW}px)` }}
        >
          <BookTitle title={title} logline={logline} />
          {chapters.map((c) => (
            <article key={c.number} className="mb-10" style={{ breakBefore: "column" }}>
              <ChapterHeading number={c.number} title={c.title} />
              <div className={proseCls}>{c.content}</div>
            </article>
          ))}
        </div>
      </div>

      {/* Pager */}
      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={spread === 0}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-control text-ink transition hover:bg-control-hover disabled:opacity-40"
        >
          ←
        </button>
        <span className="min-w-[7rem] text-center text-sm tabular-nums text-ink-soft">{label}</span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={spread >= spreadCount - 1}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-control text-ink transition hover:bg-control-hover disabled:opacity-40"
        >
          →
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">Tip: use ← / → arrow keys to turn pages.</p>
    </div>
  );
}
