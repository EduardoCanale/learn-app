/**
 * The Note format: one Markdown file per Lesson, each Annotation's Anchor
 * riding above it in an HTML comment that doubles as the entry delimiter
 * (ADR 0013). Pure — the client component edits Notes too, so nothing here may
 * touch `node:fs`. The reading and writing half lives in `lib/workspace.ts`,
 * the same split `lib/i18n.ts` and `lib/i18n.server.ts` already use.
 */

import type { Anchor } from "./anchor.ts";

export type Annotation = {
  id: string;
  at: string;
  kind: "note" | "ask";
  anchor: Anchor;
  body: string;
};

export type Note = { preamble: string; annotations: Annotation[] };

export const emptyNote = (): Note => ({ preamble: "", annotations: [] });

/** Deliberately greedy, so a quote containing `-->` still ends the marker. */
const MARKER = /^<!-- a (\{.*\}) -->$/gm;

/** Only a Lesson has a Note. Reference documents open in the reader without one. */
const LESSON = /^lessons\/([a-z0-9][a-z0-9-]{0,63})\.html$/;

export function noteKeyFor(rel: string): string | null {
  return LESSON.exec(rel)?.[1] ?? null;
}

/**
 * Never throws. A Note is someone's writing, so a marker we cannot read
 * degrades to prose rather than costing them the entry underneath it.
 */
export function parseNote(md: string): Note {
  const marks = [...md.matchAll(MARKER)];
  if (marks.length === 0) return { preamble: md, annotations: [] };

  let preamble = md.slice(0, marks[0].index);
  const annotations: Annotation[] = [];

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    const after = mark.index + mark[0].length;
    const ends = i + 1 < marks.length ? marks[i + 1].index : md.length;
    const body = md.slice(Math.min(md[after] === "\n" ? after + 1 : after, ends), ends);

    const annotation = toAnnotation(mark[1], body);
    if (annotation) {
      annotations.push(annotation);
      continue;
    }
    // Free prose: hand it back to whatever it was written under.
    const verbatim = md.slice(mark.index, ends);
    if (annotations.length) annotations[annotations.length - 1].body += verbatim;
    else preamble += verbatim;
  }

  return { preamble, annotations };
}

export function serialiseNote(note: Note): string {
  const preamble =
    note.annotations.length && note.preamble && !note.preamble.endsWith("\n")
      ? note.preamble + "\n"
      : note.preamble;

  return (
    preamble +
    note.annotations
      .map((a) => {
        // A body that does not end on a newline would push the next marker off
        // the start of its line, and the marker would parse as prose.
        const body = a.body && !a.body.endsWith("\n") ? a.body + "\n" : a.body;
        return `<!-- a ${JSON.stringify(markerFields(a))} -->\n${body}`;
      })
      .join("")
  );
}

/** The preamble a Note is created with, once. */
export const newPreamble = (lesson: string) => `# Notes — ${lesson.replace(/-/g, " ")}\n\n`;

/**
 * An entry reads as the Passage quoted, then the writing about it. The quote is
 * there twice on purpose — the blockquote for whoever reads the file, the JSON
 * for anchoring — and the two are allowed to drift apart.
 */
export function toBody(quote: string, prose: string): string {
  return `> ${quote.replace(/\s+/g, " ").trim()}\n\n${prose.trim()}\n\n`;
}

export function toProse(body: string): string {
  return body.replace(/^(?:>[^\n]*\n)+/, "").trim();
}

/**
 * The Note with one more Annotation on the end. Both ways of making one — your
 * own words, and an Ask answer you kept — land here, so an entry is assembled
 * in exactly one place.
 */
export function withAnnotation(
  note: Note,
  lesson: string,
  entry: { kind: Annotation["kind"]; anchor: Anchor; prose: string },
): Note {
  return {
    preamble: note.preamble || newPreamble(lesson),
    annotations: [
      ...note.annotations,
      {
        id: Math.random().toString(36).slice(2, 8),
        at: new Date().toISOString(),
        kind: entry.kind,
        anchor: entry.anchor,
        body: toBody(entry.anchor.quote, entry.prose),
      },
    ],
  };
}

/** The wire shape, validated before anything is written (PUT is a trust boundary). */
export function toNote(value: unknown): Note | null {
  if (!value || typeof value !== "object") return null;
  const { preamble, annotations } = value as { preamble?: unknown; annotations?: unknown };
  if (typeof preamble !== "string" || !Array.isArray(annotations)) return null;

  const out: Annotation[] = [];
  for (const raw of annotations) {
    if (!raw || typeof raw !== "object") return null;
    const a = raw as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.body !== "string") return null;
    if (a.kind !== "note" && a.kind !== "ask") return null;
    const anchor = toAnchor(a.anchor);
    if (!anchor) return null;
    out.push({ id: a.id, at: typeof a.at === "string" ? a.at : "", kind: a.kind, anchor, body: a.body });
  }
  return { preamble, annotations: out };
}

function toAnchor(value: unknown): Anchor | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  if (typeof a.quote !== "string" || typeof a.prefix !== "string" || typeof a.suffix !== "string") return null;
  if (typeof a.start !== "number" || typeof a.end !== "number") return null;
  if (!Number.isFinite(a.start) || !Number.isFinite(a.end)) return null;
  return { quote: a.quote, prefix: a.prefix, suffix: a.suffix, start: a.start, end: a.end };
}

/** The marker's flat JSON: the Anchor is inlined there, not nested. */
function markerFields(a: Annotation) {
  return {
    id: a.id,
    at: a.at,
    kind: a.kind,
    quote: a.anchor.quote,
    prefix: a.anchor.prefix,
    suffix: a.anchor.suffix,
    start: a.anchor.start,
    end: a.anchor.end,
  };
}

function toAnnotation(json: string, body: string): Annotation | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const anchor = toAnchor(o);
  if (!anchor || typeof o.id !== "string") return null;
  return {
    id: o.id,
    at: typeof o.at === "string" ? o.at : "",
    kind: o.kind === "ask" ? "ask" : "note",
    anchor,
    body,
  };
}
