// Robust JSON recovery for model output.
//
// The Anthropic API path constrains output to a JSON schema, so it is almost
// always well-formed (the only realistic failure is truncation when the output
// runs past max_tokens). The CLI dev backend has NO schema enforcement — the
// agentic `claude -p` may wrap the JSON in prose, a markdown fence, or a stray
// leading brace, or emit a trailing comma. These helpers recover the JSON from
// all of those cases so a cosmetic blemish doesn't fail the whole generation.

/** Strip a single ```json … ``` (or bare ```) fence if the text is wrapped in one. */
function stripFences(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1].trim() : t;
}

/**
 * Scan forward from an opening `{`/`[` at `start` and return the substring
 * through its matching close, respecting string literals and escapes. Returns
 * null when the block never closes (i.e. the output was truncated).
 */
function scanBalanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** Every balanced {…}/[…] block in `text`, outermost first (nested ones skipped). */
function jsonCandidates(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" || text[i] === "[") {
      const block = scanBalanced(text, i);
      if (block) {
        out.push(block);
        i += block.length - 1; // jump past this block; don't re-scan its insides
      }
    }
  }
  return out;
}

/** Last-resort fixes for the model's most common JSON slips. */
function repair(s: string): string {
  return s.replace(/,(\s*[}\]])/g, "$1"); // trailing comma before } or ]
}

/**
 * Parse JSON out of raw model text, tolerating surrounding prose, code fences,
 * a stray leading brace, or a trailing comma. Throws SyntaxError if nothing in
 * the text parses (e.g. the output was truncated mid-object).
 */
export function parseJsonLoose(text: string): unknown {
  const stripped = stripFences(text);
  const candidates = [...jsonCandidates(stripped), stripped];
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // try the next candidate
    }
  }
  for (const c of candidates) {
    try {
      return JSON.parse(repair(c));
    } catch {
      // try the next candidate
    }
  }
  throw new SyntaxError("No parseable JSON found in model output.");
}
