import { NextResponse } from "next/server";
import { getStrings } from "@/lib/i18n.server";
import { toNote } from "@/lib/notes";
import { names, sameOrigin } from "@/lib/route";
import { loadNote, saveNote } from "@/lib/workspace";

/** A Note is prose about one Lesson. Anything approaching this is not that. */
const MAX = 512 * 1024;

type Params = { params: Promise<{ ws: string; lesson: string }> };

export async function GET(_request: Request, { params }: Params) {
  const t = await getStrings();
  const { ws, lesson } = await params;

  const named = names(ws, lesson);
  if (!named) return NextResponse.json({ error: t.unknownTopic }, { status: 404 });

  return NextResponse.json(await loadNote(named.ws, named.lesson));
}

/**
 * The whole Note at once rather than a verb per Annotation: the file is small,
 * there is one writer, and it keeps the client's mutation logic in one place.
 */
export async function PUT(request: Request, { params }: Params) {
  const t = await getStrings();
  const { ws, lesson } = await params;

  const named = names(ws, lesson);
  if (!named) return NextResponse.json({ error: t.unknownTopic }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: t.badRequest }, { status: 403 });

  // Checked before reading, so an oversized body is refused rather than buffered.
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX) return NextResponse.json({ error: t.badRequest }, { status: 413 });

  const text = await request.text();
  if (text.length > MAX) return NextResponse.json({ error: t.badRequest }, { status: 413 });

  // Localhost is still a trust boundary: this writes a file.
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Falls through to the shape check below.
  }
  const note = toNote(body);
  if (!note) return NextResponse.json({ error: t.badRequest }, { status: 400 });

  await saveNote(named.ws, named.lesson, note);
  return NextResponse.json(note);
}
