import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildExport,
  bookFilename,
  EXPORT_MIME,
  type ExportBook,
  type ExportFormat,
} from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS: ExportFormat[] = ["txt", "md", "html", "epub"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") as ExportFormat | null;

  if (!format || !FORMATS.includes(format)) {
    return NextResponse.json({ error: "Unknown export format." }, { status: 400 });
  }

  const story = await prisma.story.findUnique({
    where: { id },
    include: { chapters: { orderBy: { index: "asc" } } },
  });
  if (!story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  const chapters = story.chapters
    .map((c, i) => ({ number: i + 1, title: c.title, content: (c.content ?? "").trim() }))
    .filter((c) => c.content.length > 0);

  if (chapters.length === 0) {
    return NextResponse.json({ error: "No written chapters to export yet." }, { status: 400 });
  }

  const book: ExportBook = {
    id: story.id,
    title: story.title ?? "Untitled",
    logline: story.logline,
    chapters,
  };

  const body = await buildExport(book, format);
  const filename = bookFilename(book, format);

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": EXPORT_MIME[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
