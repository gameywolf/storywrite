# AI Author — Project Plan

A web app that helps writers create full-length books **in their own voice**. The
writer describes a story; the app plans it into an editable chapter blueprint,
then generates the book one chapter at a time, keeping voice and continuity
consistent, and lets the writer read, share, and export the result.

> The original concept document is preserved at `docs/AI-Author plan.docx`.

---

## Core flow

1. **Describe** — the writer types a freeform story description (vague or detailed)
   and picks a target length.
2. **Blueprint** — Claude returns a structured plan: a title, logline, the
   *inferred* genre/POV/tense/tone/setting/characters (shown so the writer can
   correct them), and a chapter-by-chapter outline (title + description + detailed
   beat-by-beat outline).
3. **Refine** — the writer edits the blueprint manually or via an AI chat
   assistant.
4. **Voice** — the writer uploads a sample of their own writing. We save a
   structured style analysis **and** 1–2 verbatim excerpts; both are fed into every
   generation call. (Verbatim excerpts are the strongest voice signal.)
5. **Generate** — a background job writes the book one chapter per call, each call
   seeing: the blueprint (cached) + voice data (cached) + a running summary of the
   story so far + the verbatim previous chapter. After each chapter, a cheap model
   updates a **story bible** (characters, locations, timeline, facts) that feeds the
   next chapter — preventing inconsistency at write time.
6. **Review** — once the draft is complete, one **whole-story pass** (the entire
   manuscript fits in a single context window) flags cross-chapter inconsistencies,
   over-used motifs/phrases, repetition, and pacing problems. Fixes are
   **user-approved**, applied surgically.
7. **Read / share / export** — clean reader view, unguessable share links, and
   exports (EPUB, PDF, DOCX, Markdown).

---

## Architecture

- **Stack:** Next.js (App Router) + TypeScript + Tailwind. SQLite + Prisma 7 for
  the MVP (driver adapter: `@prisma/adapter-better-sqlite3`); move to Postgres later.
- **Orchestration is server-side and job-based.** A full novel is 30+ sequential
  chapter calls (minutes each) — far beyond one web request. So generation is a
  persisted **job**: a worker writes one chapter at a time, updates the bible, and
  advances a progress pointer; the browser polls. The writer can close the tab.
- **Provider abstraction (`src/lib/llm`).** The whole pipeline talks to one
  `LLMProvider` interface (`generateText`, `generateJSON`). Claude is the first
  implementation (`anthropic.ts`); OpenAI is a drop-in slot (`getProvider` switch +
  a new file). Model choice is per-story.
- **API keys** live only in the browser (localStorage), sent per-request via the
  `x-llm-key` header, **never stored server-side**. One key per provider.

```
Browser (form, key in localStorage)
  │  POST /api/blueprint  (x-llm-key header)
  ▼
Next API routes ──► Prisma/SQLite (Story, Chapter, + future Job state)
  │
  ▼
src/lib/llm (provider abstraction) ──► Claude (Opus 4.8 default) / OpenAI (later)
  ├─ generation     (chosen model, blueprint+voice cached)
  ├─ bible update   (Haiku 4.5)
  └─ whole-story review (Sonnet 4.6)
```

---

## Data model (`prisma/schema.prisma`)

- **Story** — `description` (freeform input), `targetLength`, `provider`, `model`,
  `status`, `blueprint` (Json), `inferred` (Json), voice fields (`voiceSample`,
  `voiceAnalysis`, `voiceExcerpts`), live-gen state (`storyBible`, `runningSummary`,
  `currentChapter`), `shareToken`.
- **Chapter** — `index`, `title`, `description`, `outline`, `content`, `status`,
  `wordCount`, unique on `(storyId, index)`.

---

## Models & cost

Generation model is per-story; auxiliary steps use cheaper models chosen
server-side (`src/lib/models.ts`).

| Role | Claude default |
|---|---|
| Prose generation | Opus 4.8 (Fable 5 premium / Sonnet 4.6 budget toggles) |
| Story-bible updates | Haiku 4.5 |
| Whole-story review | Sonnet 4.6 |

Rough cost of a ~100k-word novel on the user's own key: **Sonnet ≈ $6–7, Opus ≈
$9–12, Fable ≈ $18–22**. Output tokens dominate (~$0.10–0.20 / 1k finished words on
Opus). OpenAI alternative (if added): GPT-5.4-mini ≈ $1.5–2.5, GPT-5.4 ≈ $5–6,
GPT-5.5 ≈ $9–12. **Pick the generation model on prose/voice quality, not price.**

---

## Length control

Structural, not by word count: target length → (chapter count × words/chapter).
`SHORT_STORY / NOVELLA / NOVEL / EPIC` (see `TARGET_LENGTHS`). The model can't hit
exact totals, so we control the levers it *can* hit.

---

## Build phases

**Phase 1 — Core loop (in progress)**
1. ✅ Scaffold (Next.js + TS + Tailwind + Prisma/SQLite).
2. ✅ Blueprint slice: description + length form → `/api/blueprint` → Claude →
   persisted Story + Chapters → blueprint view.
3. ☐ Blueprint editing (manual, then AI chat assistant).
4. ☐ Voice sample upload → style analysis + saved excerpts.
5. ☐ Chapter generation job + worker (one chapter at a time, with the bible).
6. ☐ Reader view of the finished story.

**Phase 2 — Quality & polish**
7. ☐ Whole-story review pass with user-approved fixes.
8. ☐ Voice-fidelity prompt tuning (the "doesn't sound like AI" work).
9. ☐ Exports (EPUB first).

**Phase 3 — Future / commercial**
10. ☐ Accounts + share links.
11. ☐ Real job queue, rate/abuse handling, optional billing.

---

## Dev

```bash
npm run dev          # start the app
npx prisma migrate dev   # apply schema changes
npx prisma studio    # inspect the local DB
```

The local SQLite file (`dev.db`) and the generated Prisma client
(`src/generated/prisma`) are git-ignored; `postinstall` regenerates the client.
