"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskChunk, AskTurn } from "@/lib/ask";
import { anchorAt, flatten, resolve, type Anchor } from "@/lib/anchor";
import { dict, type Locale } from "@/lib/i18n";
import {
  emptyNote,
  noteKeyFor,
  toBody,
  toProse,
  withAnnotation,
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
 * A turn in the Ask thread. A turn asked in this session carries the Anchor the
 * question was actually about; one read back out of the transcript has only the
 * words, because that is all the transcript kept.
 */
type Turn = AskTurn & { anchor?: Anchor };

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
  const askBox = useRef<HTMLTextAreaElement>(null);

  // The Lesson the iframe is actually showing, which changes under us when a
  // sibling link inside the document is followed.
  const [showing, setShowing] = useState(lesson);
  // Read by the load handler, which must stay referentially stable: it is the
  // effect's only dependency, and re-subscribing re-fires the catch-up branch.
  const showingRef = useRef(lesson);
  const [current, setCurrent] = useState(note);
  // A Note we could not load is not an empty Note. Saving over it would erase
  // whatever is actually on disk, so a failed load blocks writing instead.
  const [stale, setStale] = useState(false);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [loads, setLoads] = useState(0);

  const [passage, setPassage] = useState<{ anchor: Anchor; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Anchor | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [prose, setProse] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"notes" | "ask">("notes");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [kept, setKept] = useState<number[]>([]);
  const [askAbout, setAskAbout] = useState<Anchor | null>(null);

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

  /** The thread lives in the Claude session, so it is read back out of it. */
  const loadThread = useCallback(
    async (which: string) => {
      const res = await fetch(`/api/ws/${ws}/ask?lesson=${encodeURIComponent(which)}`).catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as { turns?: AskTurn[] } | null) : null;
      setTurns(body?.turns ?? []);
    },
    [ws],
  );

  const reload = useCallback(
    async (next: string | null) => {
      setTurns([]);
      setKept([]);
      setStale(false);
      setCurrent(emptyNote());
      if (!next) return;

      const res = await fetch(`/api/ws/${ws}/notes/${next}`).catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as Note | null) : null;
      if (!body) {
        // Whatever is on disk is still there. Show nothing rather than an empty
        // Note, and refuse to write until a load succeeds.
        setStale(true);
        setError(t.noteLoadFailed);
        return;
      }
      setCurrent(body);
      await loadThread(next);
    },
    [ws, loadThread, t],
  );

  const onLessonReady = useCallback(() => {
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
    setAskAbout(null);
    setError(null);

    // A sibling link inside the Lesson navigates the iframe, so which Lesson we
    // are looking at is whatever the frame says it is.
    const next = noteKeyFor(relOf(doc.location.pathname, ws) ?? "");
    if (next !== showingRef.current) {
      showingRef.current = next;
      setShowing(next);
      void reload(next);
    }
    setLoads((n) => n + 1);
  }, [onSelectionChange, reload, ws]);

  useEffect(() => {
    if (lesson) void loadThread(lesson);
  }, [lesson, loadThread]);

  // Asking about a passage means the box you type in has to be in front of you,
  // and the panel may be scrolled a long way down a thread.
  useEffect(() => {
    if (askAbout) askBox.current?.focus();
  }, [askAbout]);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    iframe.addEventListener("load", onLessonReady);
    // The Lesson can finish loading before React hydrates and attaches that,
    // in which case its load event is already gone.
    if (iframe.contentDocument?.readyState === "complete") onLessonReady();
    return () => iframe.removeEventListener("load", onLessonReady);
  }, [onLessonReady]);

  /** Whole-file write: the Note is small and there is one writer. */
  async function save(next: Note): Promise<boolean> {
    if (!showing || stale) return false;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ws/${ws}/notes/${showing}`, {
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
    if (!draft || !showing || !prose.trim()) return;
    const ok = await save(withAnnotation(current, showing, { kind: "note", anchor: draft, prose }));
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

  async function send() {
    if (!showing || asking || !question.trim()) return;
    // A follow-up with no fresh selection stays on the passage the thread is about.
    const anchor = askAbout ?? turns.at(-1)?.anchor;
    const quote = anchor?.quote ?? turns.at(-1)?.quote ?? "";
    const asked = question.trim();

    setAsking(true);
    setError(null);
    setQuestion("");
    setTurns((all) => [...all, { quote, question: asked, answer: "", anchor }]);

    const res = await fetch(`/api/ws/${ws}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lesson: showing, question: asked, quote }),
    }).catch(() => null);

    if (!res?.ok || !res.body) {
      setAsking(false);
      setError(t.askFailed);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // The last piece is whatever arrived without its newline yet.
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk: AskChunk;
        try {
          chunk = JSON.parse(line) as AskChunk;
        } catch {
          continue;
        }
        if (chunk.type === "text") {
          const { text } = chunk;
          setTurns((all) => all.map((turn, i) => (i === all.length - 1 ? { ...turn, answer: turn.answer + text } : turn)));
        }
        if (chunk.type === "error") setError(t.askFailed);
      }
    }
    setAsking(false);
  }

  /** Nothing is written to the Note until this is pressed (ADR 0015). */
  async function keep(i: number) {
    const turn = turns[i];
    const ix = index.current;
    if (!showing || !turn?.answer.trim()) return;

    // A turn asked in this session already holds the Anchor the question was
    // about — including which of two identical passages it was. Only a turn
    // rehydrated from the transcript has to go looking.
    const anchor = turn.anchor ?? (ix && anchorFor(ix, turn.quote));
    if (!anchor) return setError(t.passageMoved);

    const prose = `**Q:** ${turn.question}\n\n**A:** ${turn.answer.trim()}`;
    const ok = await save(withAnnotation(current, showing, { kind: "ask", anchor, prose }));
    if (ok) setKept((all) => [...all, i]);
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
        {passage && !draft && showing && (
          <div className="reader-tools" style={{ left: passage.x, top: passage.y }}>
            <button
              onClick={() => {
                setDraft(passage.anchor);
                setEditing(null);
                setProse("");
                setTab("notes");
              }}
            >
              {t.addNote}
            </button>
            <button
              onClick={() => {
                setAskAbout(passage.anchor);
                setPassage(null);
                setTab("ask");
              }}
            >
              {t.askClaude}
            </button>
          </div>
        )}
      </div>

      <aside className="panel reader-panel">
        <div className="reader-tabs">
          <button
            aria-pressed={tab === "notes"}
            className={tab === "notes" ? undefined : "quiet"}
            onClick={() => setTab("notes")}
          >
            {t.notes}
            {placed.length > 0 && ` · ${placed.length}`}
          </button>
          <button
            aria-pressed={tab === "ask"}
            className={tab === "ask" ? undefined : "quiet"}
            onClick={() => setTab("ask")}
          >
            {t.askClaude}
            {turns.length > 0 && ` · ${turns.length}`}
          </button>
        </div>

        {tab === "ask" ? (
          <>
            {!showing && <p className="note">{t.askNotHere}</p>}
            {showing && turns.length === 0 && <p className="note">{t.askEmpty}</p>}

            <ol className="plain">
              {turns.map((turn, i) => (
                <li key={i} className="entry-note">
                  {turn.quote && <blockquote>{turn.quote}</blockquote>}
                  <p className="ask-q">{turn.question}</p>
                  <p className="ask-a">
                    {turn.answer || (asking && i === turns.length - 1 ? t.asking : "")}
                  </p>
                  {turn.answer.trim() && !(asking && i === turns.length - 1) && (
                    <div className="row">
                      <button className="quiet" onClick={() => keep(i)} disabled={busy || kept.includes(i)}>
                        {kept.includes(i) ? t.keptAnswer : t.keepAnswer}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>

            {showing && (
              <>
                {askAbout && <blockquote className="ask-about">{askAbout.quote}</blockquote>}
                <textarea
                  ref={askBox}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
                  }}
                  placeholder={t.askPlaceholder}
                  aria-label={t.askClaude}
                  disabled={asking}
                />
                <div className="row">
                  <button onClick={() => void send()} disabled={asking || !question.trim()}>
                    {asking ? t.asking : t.askSend}
                  </button>
                  <span className="hint-key">⌘↵</span>
                </div>
              </>
            )}

          </>
        ) : (
          <>
        {!showing && <p className="note">{t.noNotesHere}</p>}

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

        {showing && ordered.length === 0 && !draft && !stale && <p className="note">{t.noNotesYet}</p>}

        <ul className="plain">
          {ordered.map((a) => (
            <li key={a.id} className={a.id === focus ? "entry-note lit" : "entry-note"}>
              {a.offset === null && loads > 0 && <p className="warn">{t.passageMoved}</p>}
              <button className="entry-quote" onClick={() => reveal(a)}>
                <blockquote>{a.anchor.quote}</blockquote>
              </button>

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
          </>
        )}
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
  // Built off the flat text rather than the Range, because flat text is the
  // only thing a quote is ever searched for in.
  return { anchor: anchorAt(ix.text, start, end), x: box.left + box.width / 2, y: box.top };
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

/**
 * An Anchor for a quote that is already known, used when keeping an answer from
 * a thread that was rehydrated: the transcript recorded only the words, so the
 * position and the context come from the document as it stands now. A turn
 * asked in this session keeps its real Anchor and never comes here.
 */
function anchorFor(ix: Index, quote: string): Anchor | null {
  const wanted = quote.trim();
  const start = wanted ? ix.text.indexOf(wanted) : -1;
  return start === -1 ? null : anchorAt(ix.text, start, start + wanted.length);
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
