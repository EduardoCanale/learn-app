import { access } from "node:fs/promises";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getStrings } from "@/lib/i18n.server";
import { emptyNote, noteKeyFor } from "@/lib/notes";
import { inWorkspace, workspaceName } from "@/lib/paths";
import { loadNote } from "@/lib/workspace";
import LessonReader from "./LessonReader";

export const dynamic = "force-dynamic";

/**
 * The Lesson itself is not rendered here — it is served raw by
 * `/api/ws/<ws>/raw` and framed by the client component (ADR 0014). This page
 * only resolves which Lesson it is and hands over its Note.
 */
export default async function LessonPage({ params }: { params: Promise<{ ws: string; path: string[] }> }) {
  const { ws: raw, path: parts } = await params;
  const [t, locale] = await Promise.all([getStrings(), getLocale()]);

  let ws: string;
  let rel: string;
  try {
    ws = workspaceName(raw);
    rel = parts.map(decodeURIComponent).join("/");
    if (!rel.toLowerCase().endsWith(".html")) notFound();
    await access(inWorkspace(ws, rel));
  } catch {
    notFound();
  }

  const lesson = noteKeyFor(rel);
  const note = lesson ? await loadNote(ws, lesson) : emptyNote();

  return (
    <>
      <header className="masthead">
        <h1>{rel.split("/").pop()}</h1>
        <Link className="back" href={`/ws/${ws}`}>{t.backTo(ws)}</Link>
      </header>
      <LessonReader ws={ws} rel={rel} lesson={lesson} note={note} locale={locale} />
    </>
  );
}
