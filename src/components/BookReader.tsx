"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Chapter {
  number: number;
  title: string;
  content: string;
}

interface NavChapter {
  number: number;
  title: string;
}

type Mode = "scroll" | "pages";

interface Props {
  storyId: string;
  title: string;
  logline: string | null;
  chapter: Chapter;
  chapters: NavChapter[];
  prevNumber: number | null;
  nextNumber: number | null;
  position: number; // 1-based position among readable chapters
  total: number;
  isFirst: boolean;
  initialMode: Mode;
  startAtEnd: boolean; // land on the last page (when flipping back into this chapter)
}

export default function BookReader({
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
  initialMode,
  startAtEnd,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  // Keep the reading mode when moving between chapters so flipping pages is seamless.
  // `atEnd` asks the target chapter to open on its last page (flipping backwards).
  const href = (n: number, atEnd = false) => {
    const params = new URLSearchParams();
    if (mode === "pages") params.set("mode", "pages");
    if (atEnd) params.set("start", "last");
    const q = params.toString();
    return `/story/${storyId}/read/${n}${q ? `?${q}` : ""}`;
  };
  const gotoChapter = (n: number | null, atEnd = false) => {
    // In pages mode, keep the window scroll position so flipping to the next
    // chapter doesn't jump the page to the top. Scroll mode scrolls to top as usual.
    if (n != null) router.push(href(n, atEnd), { scroll: mode !== "pages" });
  };

  const segBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 font-medium transition ${
      active ? "bg-go text-go-ink shadow-sm" : "text-ink-soft hover:text-ink"
    }`;

  return (
    <div>
      {/* Top bar: back link + edit/export + format toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/story/${storyId}`} className="text-sm text-ink-soft hover:text-ink hover:underline">
          ← Back to blueprint
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/story/${storyId}/edit/${chapter.number}`}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-control"
          >
            Edit
          </Link>
          <ExportMenu storyId={storyId} />
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm shadow-sm">
            <button type="button" onClick={() => setMode("scroll")} className={segBtn(mode === "scroll")}>
              Scroll
            </button>
            <button type="button" onClick={() => setMode("pages")} className={segBtn(mode === "pages")}>
              Pages
            </button>
          </div>
        </div>
      </div>

      {/* Chapter navigation */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
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
          className="max-w-[18rem] truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink shadow-sm outline-none focus:border-go"
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

      <div className="mt-5">
        {mode === "scroll" ? (
          <ScrollView
            title={title}
            logline={logline}
            chapter={chapter}
            isFirst={isFirst}
            nextNumber={nextNumber}
            onNext={() => gotoChapter(nextNumber)}
          />
        ) : (
          <PagesView
            title={title}
            logline={logline}
            chapter={chapter}
            isFirst={isFirst}
            prevNumber={prevNumber}
            nextNumber={nextNumber}
            startAtEnd={startAtEnd}
            onFlip={gotoChapter}
          />
        )}
      </div>
    </div>
  );
}

// ---- Export menu ------------------------------------------------------------

const EXPORTS: { format: string; label: string }[] = [
  { format: "epub", label: "EPUB e-book" },
  { format: "md", label: "Markdown (.md)" },
  { format: "html", label: "HTML" },
  { format: "txt", label: "Plain text (.txt)" },
];

function ExportMenu({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-control"
      >
        Export
        <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-card"
        >
          {EXPORTS.map((e) => (
            <a
              key={e.format}
              href={`/api/stories/${storyId}/export?format=${e.format}`}
              download
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-1.5 text-sm text-ink transition hover:bg-control"
            >
              {e.label}
            </a>
          ))}
        </div>
      )}
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

// ---- Continuous scroll (one chapter) ----------------------------------------

function ScrollView({
  title,
  logline,
  chapter,
  isFirst,
  nextNumber,
  onNext,
}: {
  title: string;
  logline: string | null;
  chapter: Chapter;
  isFirst: boolean;
  nextNumber: number | null;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface px-6 py-12 shadow-card sm:px-14 sm:py-16">
      {isFirst && <BookTitle title={title} logline={logline} />}
      <article>
        <ChapterHeading number={chapter.number} title={chapter.title} />
        <div className={proseCls}>{chapter.content}</div>
      </article>
      {nextNumber != null && (
        <div className="mt-16 flex flex-col items-center gap-4">
          <div aria-hidden className="text-center text-ai/70">❦</div>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg border border-line bg-control px-4 py-2 text-sm font-medium text-ink transition hover:bg-control-hover"
          >
            Next chapter →
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Paginated "book" (one chapter, flips into neighbours) ------------------

const MARGIN = 40; // per-side text margin within a page, in px
const TWO_PAGE_MIN = 1024; // window width (px) at/above which we show a spread

function PagesView({
  title,
  logline,
  chapter,
  isFirst,
  prevNumber,
  nextNumber,
  startAtEnd,
  onFlip,
}: {
  title: string;
  logline: string | null;
  chapter: Chapter;
  isFirst: boolean;
  prevNumber: number | null;
  nextNumber: number | null;
  startAtEnd: boolean;
  onFlip: (n: number | null, atEnd?: boolean) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0); // viewport width = one spread
  const [perView, setPerView] = useState(1); // pages shown at once (1 or 2)
  const [pageCount, setPageCount] = useState(1); // total pages (columns)
  const [spread, setSpread] = useState(0); // current spread index
  // When we arrived by flipping backwards, jump to the last page once measured.
  const appliedStart = useRef(false);

  const spreadCount = Math.max(1, Math.ceil(pageCount / perView));

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
      const lastSpread = Math.ceil(count / perView) - 1;
      if (startAtEnd && !appliedStart.current) {
        appliedStart.current = true;
        setSpread(lastSpread);
      } else {
        setSpread((s) => Math.min(s, lastSpread));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [viewW, perView, chapter.content, startAtEnd]);

  // Turn a page; past the ends, flip cleanly into the neighbouring chapter.
  const go = (dir: 1 | -1) => {
    const target = spread + dir;
    if (target < 0) {
      if (prevNumber != null) onFlip(prevNumber, true); // open previous chapter on its last page
      return;
    }
    if (target > spreadCount - 1) {
      if (nextNumber != null) onFlip(nextNumber);
      return;
    }
    setSpread(target);
  };

  // Arrow-key paging (also flips between chapters at the ends).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // go() closes over spread/spreadCount/neighbours; re-subscribe when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread, spreadCount, prevNumber, nextNumber]);

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

  const canPrev = spread > 0 || prevNumber != null;
  const canNext = spread < spreadCount - 1 || nextNumber != null;

  return (
    <div className="flex flex-col items-center">
      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden"
        style={{ height: "min(74vh, 780px)", maxWidth: perView === 2 ? "64rem" : "44rem" }}
      >
        <div aria-hidden className="absolute inset-0 rounded-2xl border border-line bg-surface shadow-card" />

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

        <div
          ref={flowRef}
          className="absolute inset-0"
          style={{ ...colStyle, padding: MARGIN, transform: `translateX(-${spread * viewW}px)` }}
        >
          {isFirst && <BookTitle title={title} logline={logline} />}
          <article style={{ breakBefore: isFirst ? "column" : "auto" }}>
            <ChapterHeading number={chapter.number} title={chapter.title} />
            <div className={proseCls}>{chapter.content}</div>
          </article>
        </div>
      </div>

      {/* Pager */}
      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={!canPrev}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-control text-ink transition hover:bg-control-hover disabled:opacity-40"
        >
          ←
        </button>
        <span className="min-w-[7rem] text-center text-sm tabular-nums text-ink-soft">{label}</span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!canNext}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-control text-ink transition hover:bg-control-hover disabled:opacity-40"
        >
          →
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">
        Tip: use ← / → arrow keys to turn pages — past the last page you&apos;ll flip to the next chapter.
      </p>
    </div>
  );
}
