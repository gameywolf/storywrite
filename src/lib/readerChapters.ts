// Shared helper for the per-chapter reader/editor pages. A chapter is
// "readable" once it has prose. Its URL number is its 1-based position in the
// full chapter list (index + 1) — stable because chapter indexes are kept
// contiguous (0..n-1) by the story PATCH route and generation.

export interface ReadableChapter {
  index: number; // real 0-based index (used to save)
  number: number; // 1-based display / URL number
  title: string;
  content: string;
}

export function readableChapters(
  chapters: { index: number; title: string; content: string | null }[],
): ReadableChapter[] {
  return chapters
    .map((c) => ({
      index: c.index,
      number: c.index + 1,
      title: c.title,
      content: (c.content ?? "").trim(),
    }))
    .filter((c) => c.content.length > 0);
}
