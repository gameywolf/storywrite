import JSZip from "jszip";

// Builds downloadable versions of a finished (or partly written) book:
// plain text, Markdown, a self-contained HTML file, and a real EPUB.

export interface ExportChapter {
  number: number; // display number (position in the full chapter list)
  title: string;
  content: string;
}

export interface ExportBook {
  id: string;
  title: string;
  logline: string | null;
  chapters: ExportChapter[];
}

export type ExportFormat = "txt" | "md" | "html" | "epub";

export const EXPORT_MIME: Record<ExportFormat, string> = {
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  epub: "application/epub+zip",
};

export function bookFilename(book: ExportBook, format: ExportFormat): string {
  const slug =
    (book.title || "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled";
  return `${slug}.${format}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Split prose into paragraphs (blank-line separated); single newlines → <br/>. */
function paragraphsHtml(content: string): string {
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

// ---- Plain text -------------------------------------------------------------

export function buildTxt(book: ExportBook): string {
  const parts: string[] = [book.title || "Untitled"];
  if (book.logline) parts.push(book.logline);
  parts.push("");
  for (const c of book.chapters) {
    parts.push("", `Chapter ${c.number}: ${c.title}`, "", c.content.trim(), "");
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---- Markdown ---------------------------------------------------------------

export function buildMarkdown(book: ExportBook): string {
  const parts: string[] = [`# ${book.title || "Untitled"}`];
  if (book.logline) parts.push(`*${book.logline}*`);
  for (const c of book.chapters) {
    parts.push("", `## Chapter ${c.number}: ${c.title}`, "", c.content.trim());
  }
  return parts.join("\n") + "\n";
}

// ---- HTML (self-contained) --------------------------------------------------

const HTML_CSS = `
  :root { color-scheme: light; }
  body { max-width: 40rem; margin: 4rem auto; padding: 0 1.5rem;
    font-family: Georgia, "Times New Roman", serif; line-height: 1.85;
    color: #2a2218; background: #f4f0e6; }
  h1 { text-align: center; font-size: 2.4rem; margin-bottom: .5rem; }
  .logline { text-align: center; font-style: italic; color: #6e6555; margin-top: 0; }
  .divider { text-align: center; color: #b768c9; margin: 2.5rem 0; }
  h2 { text-align: center; font-size: 1.6rem; margin: 3.5rem 0 1.5rem; }
  .eyebrow { text-align: center; text-transform: uppercase; letter-spacing: .2em;
    font-size: .75rem; color: #6e6555; margin-bottom: .25rem; }
  p { margin: 0 0 1rem; }
`;

export function buildHtml(book: ExportBook): string {
  const title = escapeHtml(book.title || "Untitled");
  const chapters = book.chapters
    .map(
      (c) => `<section>
  <p class="eyebrow">Chapter ${c.number}</p>
  <h2>${escapeHtml(c.title)}</h2>
  ${paragraphsHtml(c.content)}
</section>`,
    )
    .join('\n<div class="divider">❦</div>\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>${HTML_CSS}</style>
</head>
<body>
<h1>${title}</h1>
${book.logline ? `<p class="logline">${escapeHtml(book.logline)}</p>` : ""}
<div class="divider">❦</div>
${chapters}
</body>
</html>
`;
}

// ---- EPUB 3 -----------------------------------------------------------------

const EPUB_CSS = `body { font-family: serif; line-height: 1.7; }
h1 { text-align: center; }
h2 { text-align: center; margin-top: 2em; }
.eyebrow { text-align: center; text-transform: uppercase; letter-spacing: .2em; font-size: .8em; color: #555; }
.logline { text-align: center; font-style: italic; color: #555; }
p { margin: 0 0 1em; text-indent: 0; }`;

function chapterXhtml(c: ExportChapter): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(c.title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
<p class="eyebrow">Chapter ${c.number}</p>
<h2>${escapeHtml(c.title)}</h2>
${paragraphsHtml(c.content)}
</body>
</html>`;
}

export async function buildEpub(book: ExportBook): Promise<Uint8Array> {
  const zip = new JSZip();
  const title = book.title || "Untitled";
  const uid = `urn:penghost:${book.id}`;

  // mimetype must be first and uncompressed.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder("OEBPS")!;
  oebps.file("style.css", EPUB_CSS);

  // Title page
  oebps.file(
    "title.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>${escapeHtml(title)}</h1>
${book.logline ? `<p class="logline">${escapeHtml(book.logline)}</p>` : ""}
</body>
</html>`,
  );

  for (const c of book.chapters) {
    oebps.file(`chapter-${c.number}.xhtml`, chapterXhtml(c));
  }

  // EPUB3 navigation document
  const navItems = book.chapters
    .map((c) => `<li><a href="chapter-${c.number}.xhtml">Chapter ${c.number}: ${escapeHtml(c.title)}</a></li>`)
    .join("\n");
  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body>
<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
${navItems}
</ol></nav>
</body>
</html>`,
  );

  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    ...book.chapters.map(
      (c) => `<item id="ch${c.number}" href="chapter-${c.number}.xhtml" media-type="application/xhtml+xml"/>`,
    ),
  ].join("\n    ");

  const spineItems = [
    `<itemref idref="title"/>`,
    ...book.chapters.map((c) => `<itemref idref="ch${c.number}"/>`),
  ].join("\n    ");

  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Penghost</dc:creator>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
}

export async function buildExport(
  book: ExportBook,
  format: ExportFormat,
): Promise<string | Uint8Array> {
  switch (format) {
    case "txt":
      return buildTxt(book);
    case "md":
      return buildMarkdown(book);
    case "html":
      return buildHtml(book);
    case "epub":
      return buildEpub(book);
  }
}
