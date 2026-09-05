"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONTEXT, flatten, resolve, type Anchor } from "@/lib/anchor";
import { dict, type Locale } from "@/lib/i18n";
import {
  emptyNote,
  newPreamble,
  noteKeyFor,
  toBody,
  toProse,
  type Annotation,
  type Note,
} from "@/lib/notes";

/** A text node and where its raw text starts in the concatenation of all of them. */
type Piece = { node: Text; start: number };
type Index = { text: string; from: number[]; pieces: Piece[] };
/** An Annotation and where its Passage is now, or null if the Lesson lost it.
 *  `at` on an Annotation is when it was written; `offset` is where it points. */
type Placed = Annotation & { offset: number | null };

/**
 * The only thing the app puts inside a Lesson. Highlights themselves are
 * Ranges in `CSS.highlights`, so the document keeps no marks (ADR 0014).
 */
const HIGHLIGHT_CSS = `
::highlight(annotation) { background-color: rgba(255, 206, 84, 0.34); }
::highlight(annotation-focus) { background-color: rgba(255, 186, 40, 0.72); }
`;

export default function LessonReader({
  ws,
  rel,
  lesson,
  note,
  locale,
}: {
  ws: string;
  rel: string;
  lesson: string | null;
  note: Note;
  locale: Locale;
}) {
  const t = dict[locale];
  const frame = useRef<HTMLIFrameElement>(null);
  const index = useRef<Index | null>(null);

  // The Lesson the iframe is actually showing, which changes under us when a
  // sibling link inside the document is followed.
  const [key, setKey] = useState(lesson);
  const lessonNow = useRef(lesson);
  const [current, setCurrent] = useState(note);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [loads, setLoads] = useState(0);

  const [passage, setPassage] = useState<{ anchor: Anchor; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Anchor | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [prose, setProse] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paint = useCallback((annotations: Annotation[], focused: string | null): Placed[] => {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    const ix = index.current;
    // Before the Lesson is in, the entries still list; they just have nowhere
    // to point yet, which is not the same as having lost their Passage.
    if (!doc || !win || !ix) return annotations.map((a) => ({ ...a, offset: null }));

    const out = annotations.map((a) => ({ ...a, offset: resolve(ix.text, a.anchor) }));

    // Baseline since June 2025. Without it the panel still works; only the
    // painting is lost, which is not worth failing the page over.
    const registry = win.CSS?.highlights;
    const Highlight = win.Highlight;
    if (registry && Highlight) {
      const plain: Range[] = [];
      const lit: Range[] = [];
      for (const a of out) {
        if (a.offset === null) continue;
        const range = rangeFor(ix, doc, a.offset, a.anchor.quote.length);
        if (range) (a.id === focused ? lit : plain).push(range);
      }
      registry.set("annotation", new Highlight(...plain));
      registry.set("annotation-focus", new Highlight(...lit));
    }
    return out;
  }, []);

  useEffect(() => {
    setPlaced(paint(current.annotations, focus));
  }, [current, focus, loads, paint]);

  const onSelectionChange = useCallback(() => {
    setPassage(capture(frame.current, index.current));
  }, []);

  const reload = useCallback(
    async (next: string | null) => {
      if (!next) return setCurrent(emptyNote());
      const res = await fetch(`/api/ws/${ws}/notes/${next}`).catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as Note | null) : null;
      setCurrent(body ?? emptyNote());
    },
    [ws],
  );

  const settle = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc || doc.location.href === "about:blank") return;

    index.current = buildIndex(doc);
    if (!doc.getElementById("learn-annotations")) {
      const style = doc.createElement("style");
      style.id = "learn-annotations";
      style.textContent = HIGHLIGHT_CSS;
      doc.head.append(style);
    }
    doc.addEventListener("selectionchange", onSelectionChange);

    setPassage(null);
    setDraft(null);
    setEditing(null);
    setFocus(null);

    // A sibling link inside the Lesson navigates the iframe, so which Lesson we
    // are looking at is whatever the frame says it is.
    const next = noteKeyFor(relOf(doc.location.pathname, ws) ?? "");
    if (next !== lessonNow.current) {
      lessonNow.current = next;
      setKey(next);
      void reload(next);
    }
    setLoads((n) => n + 1);
  }, [onSelectionChange, reload, ws]);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    iframe.addEventListener("load", settle);
    // The Lesson can finish loading before React hydrates and attaches that,
    // in which case its load event is already gone.
    if (iframe.contentDocument?.readyState === "complete") settle();
    return () => iframe.removeEventListener("load", settle);
  }, [settle]);

  /** Whole-file write: the Note is small and there is one writer. */
  async function save(next: Note): Promise<boolean> {
    if (!key) return false;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ws/${ws}/notes/${key}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => null);
    setBusy(false);
    // The writing stays in the box until it is on disk.
    if (!res?.ok) {
      setError(t.noteSaveFailed);
      return false;
    }
    setCurrent(next);
    return true;
  }

  async function add() {
    if (!draft || !key || !prose.trim()) return;
    const written: Annotation = {
      id: Math.random().toString(36).slice(2, 8),
      at: new Date().toISOString(),
      kind: "note",
      anchor: draft,
      body: toBody(draft.quote, prose),
    };
    const ok = await save({
      preamble: current.preamble || newPreamble(key),
      annotations: [...current.annotations, written],
    });
    if (ok) {
      setDraft(null);
      setProse("");
      setPassage(null);
    }
  }

  async function commit(id: string) {
    const ok = await save({
      ...current,
      annotations: current.annotations.map((a) =>
        a.id === id ? { ...a, body: toBody(a.anchor.quote, prose) } : a,
      ),
    });
    if (ok) {
      setEditing(null);
      setProse("");
    }
  }

  async function remove(a: Placed) {
    if (!window.confirm(t.deleteNoteConfirm)) return;
    await save({ ...current, annotations: current.annotations.filter((x) => x.id !== a.id) });
  }

  function reveal(a: Placed) {
    setFocus(a.id);
    const doc = frame.current?.contentDocument;
    const ix = index.current;
    if (!doc || !ix || a.offset === null) return;
    const range = rangeFor(ix, doc, a.offset, a.anchor.quote.length);
    range?.startContainer.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // Unanchored entries first: they need saying something about, the rest read
  // in the order the Lesson does.
  const ordered = [...placed].sort((a, b) =>
    a.offset === null ? (b.offset === null ? 0 : -1) : b.offset === null ? 1 : a.offset - b.offset,
  );

  return (
    <div className="reader">
      <div className="reader-frame">
        <iframe
          ref={frame}
          src={`/api/ws/${ws}/raw/${rel.split("/").map(encodeURIComponent).join("/")}`}
          title={rel}
        />
        {passage && !draft && key && (
          <div className="reader-tools" style={{ left: passage.x, top: passage.y }}>
            <button
              onClick={() => {
                setDraft(passage.anchor);
                setEditing(null);
                setProse("");
              }}
            >
              {t.addNote}
            </button>
          </div>
        )}
      </div>

      <aside className="panel reader-panel">
        <h2>
          {t.notes}
          {key && placed.length > 0 && <span className="note"> {t.noteCount(placed.length)}</span>}
        </h2>

        {!key && <p className="note">{t.noNotesHere}</p>}

        {draft && (
          <div className="entry-note">
            <blockquote>{draft.quote}</blockquote>
            <textarea
              autoFocus
              value={prose}
              onChange={(e) => setProse(e.target.value)}
              placeholder={t.notePlaceholder}
              aria-label={t.addNote}
              disabled={busy}
            />
            <div className="row">
              <button onClick={add} disabled={busy || !prose.trim()}>{t.saveNote}</button>
              <button className="quiet" onClick={() => { setDraft(null); setProse(""); }}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {key && ordered.length === 0 && !draft && <p className="note">{t.noNotesYet}</p>}

        <ul className="plain">
          {ordered.map((a) => (
            <li key={a.id} className={a.id === focus ? "entry-note lit" : "entry-note"}>
              {a.offset === null && loads > 0 && <p className="warn">{t.passageMoved}</p>}
              <blockquote onClick={() => reveal(a)}>{a.anchor.quote}</blockquote>

              {editing === a.id ? (
                <>
                  <textarea
                    autoFocus
                    value={prose}
                    onChange={(e) => setProse(e.target.value)}
                    aria-label={t.editNote}
                    disabled={busy}
                  />
                  <div className="row">
                    <button onClick={() => commit(a.id)} disabled={busy}>{t.saveNote}</button>
                    <button className="quiet" onClick={() => { setEditing(null); setProse(""); }}>
                      {t.cancel}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{toProse(a.body)}</p>
                  <div className="row">
                    <button
                      className="quiet"
                      onClick={() => { setEditing(a.id); setDraft(null); setProse(toProse(a.body)); }}
                    >
                      {t.editNote}
                    </button>
                    <button className="quiet" onClick={() => remove(a)} disabled={busy}>
                      {t.deleteNote}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {error && <p className="warn">{error}</p>}
      </aside>
    </div>
  );
}

/* --- the DOM half of anchoring ------------------------------------------ */

/** `/api/ws/<ws>/raw/lessons/0001-x.html` back to `lessons/0001-x.html`. */
function relOf(pathname: string, ws: string): string | null {
  const prefix = `/api/ws/${ws}/raw/`;
  return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : null;
}

function buildIndex(doc: Document): Index {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const pieces: Piece[] = [];
  let raw = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!text.data || text.parentElement?.closest("script, style")) continue;
    pieces.push({ node: text, start: raw.length });
    raw += text.data;
  }
  const { text, from } = flatten(raw);
  return { text, from, pieces };
}

function capture(
  iframe: HTMLIFrameElement | null,
  ix: Index | null,
): { anchor: Anchor; x: number; y: number } | null {
  const doc = iframe?.contentDocument;
  const selection = doc?.getSelection();
  if (!doc || !ix || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!doc.body.contains(range.commonAncestorContainer)) return null;

  const start = flatAt(ix, range.startContainer, range.startOffset, "start");
  const end = flatAt(ix, range.endContainer, range.endOffset, "end");
  if (start === null || end === null || end <= start) return null;

  const box = range.getBoundingClientRect();
  return {
    anchor: {
      // Sliced out of the flat text rather than taken from the Range, because
      // flat text is the only thing the quote is ever searched for in.
      quote: ix.text.slice(start, end),
      prefix: ix.text.slice(Math.max(0, start - CONTEXT), start),
      suffix: ix.text.slice(end, end + CONTEXT),
      start,
      end,
    },
    x: box.left + box.width / 2,
    y: box.top,
  };
}

function flatAt(ix: Index, node: Node, offset: number, side: "start" | "end"): number | null {
  const raw = rawAt(ix, node, offset, side);
  if (raw === null) return null;
  const at = ix.from.findIndex((r) => r >= raw);
  return at === -1 ? ix.text.length : at;
}

function rawAt(ix: Index, node: Node, offset: number, side: "start" | "end"): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const piece = ix.pieces.find((p) => p.node === node);
    return piece ? piece.start + Math.min(offset, (node as Text).data.length) : null;
  }
  // A selection that starts or ends on a block boundary comes back as an
  // element and a child index.
  // ponytail: snaps to that child's whole text rather than its exact edge. The
  // difference is whitespace the reader could not have selected on purpose.
  const scope = node.childNodes[side === "start" ? offset : Math.max(0, offset - 1)] ?? node;
  const inside = ix.pieces.filter((p) => scope.contains(p.node));
  if (inside.length === 0) return null;
  const edge = side === "start" ? inside[0] : inside[inside.length - 1];
  return side === "start" ? edge.start : edge.start + edge.node.data.length;
}

function rangeFor(ix: Index, doc: Document, at: number, length: number): Range | null {
  const from = pointAt(ix, at);
  const to = pointAt(ix, at + length - 1);
  if (!from || !to) return null;
  const range = doc.createRange();
  try {
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, Math.min(to.offset + 1, to.node.data.length));
  } catch {
    return null;
  }
  return range.collapsed ? null : range;
}

function pointAt(ix: Index, flat: number): { node: Text; offset: number } | null {
  const raw = ix.from[flat];
  if (raw === undefined) return null;
  let found: Piece | undefined;
  for (const piece of ix.pieces) {
    if (piece.start > raw) break;
    found = piece;
  }
  return found ? { node: found.node, offset: Math.min(raw - found.start, found.node.data.length) } : null;
}
