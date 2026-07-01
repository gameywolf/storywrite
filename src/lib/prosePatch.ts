// Client-safe helpers for prose edits. NO server imports (getProvider, prisma,
// etc.) so BookEditor can import this in the browser to preview a proposal
// before it's saved.
//
// To save output tokens the AI never re-emits a whole chapter: it returns only
// the paragraphs it is changing as a list of edits. Paragraph numbers are
// 1-based and operations apply top-to-bottom — each `paragraph` refers to the
// position AFTER the earlier ops in the list have been applied (same convention
// as the chapter ops in src/lib/blueprintChat.ts).

export type ProseOp = "replace" | "insert" | "remove";

export interface ProseEdit {
  op: ProseOp;
  /** 1-based paragraph number. For "insert", the position to insert at. */
  paragraph: number;
  /** New/replacement paragraph text. Empty for "remove". */
  text: string;
}

export interface ProseProposal {
  /** Short note to the writer, or a clarifying question (with no edits). */
  reply: string;
  /** Only the changed paragraphs — empty if the model is just asking a question. */
  edits: ProseEdit[];
  /** A ready-to-send blueprint instruction, or "" when the plan needn't change. */
  blueprintInstruction: string;
}

/** One before/after entry, used to render the preview. */
export interface ProseChange {
  op: ProseOp;
  before: string | null;
  after: string | null;
}

/** Split a chapter's prose into paragraphs (blank-line separated), matching the
 *  export/reader convention in src/lib/export.ts. */
export function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Re-join paragraphs into a chapter content string. */
export function joinParagraphs(paras: string[]): string {
  return paras.join("\n\n");
}

/** Apply a list of paragraph edits, returning the new paragraph array plus a
 *  before/after change log for the preview UI. */
export function applyProseEdits(
  paras: string[],
  edits: ProseEdit[],
): { paragraphs: string[]; changes: ProseChange[] } {
  const out = [...paras];
  const changes: ProseChange[] = [];

  for (const e of edits) {
    const i = e.paragraph - 1;
    if (e.op === "insert") {
      const at = i >= 0 && i <= out.length ? i : out.length;
      out.splice(at, 0, e.text);
      changes.push({ op: "insert", before: null, after: e.text });
    } else if (e.op === "remove") {
      if (i >= 0 && i < out.length) {
        const [removed] = out.splice(i, 1);
        changes.push({ op: "remove", before: removed, after: null });
      }
    } else {
      // replace
      if (i >= 0 && i < out.length) {
        const before = out[i];
        out[i] = e.text;
        changes.push({ op: "replace", before, after: e.text });
      }
    }
  }

  return { paragraphs: out, changes };
}
