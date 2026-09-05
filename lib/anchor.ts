/**
 * Finding a Passage again after the Lesson it lives in has been rewritten
 * (ADR 0014). Pure string work: this file runs on the server and in the
 * browser, so it imports neither `node:fs` nor the DOM.
 *
 * Offsets are into the Lesson's flat text — every text node in document order,
 * script and style skipped, each run of whitespace collapsed to one space, the
 * ends trimmed. That is `lib/source.ts:toText`'s rule, and `flatten` below is
 * the only place it is written down: capture normalising differently from
 * resolution puts every Anchor one character off, silently.
 */

export type Anchor = {
  quote: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
};

/** How much text either side of a Passage is kept to tell two copies apart. */
const CONTEXT = 32;

/**
 * The Anchor for a span of flat text: the words, the words either side of them,
 * and the position — which is only ever a hint. The counterpart of `resolve`,
 * and the only place an Anchor is built.
 */
export function anchorAt(flatText: string, start: number, end: number): Anchor {
  return {
    quote: flatText.slice(start, end),
    prefix: flatText.slice(Math.max(0, start - CONTEXT), start),
    suffix: flatText.slice(end, end + CONTEXT),
    start,
    end,
  };
}

/**
 * Collapse whitespace, reporting where in `raw` each surviving character came
 * from. The browser needs that map to turn an offset back into a Range; the
 * server only ever wants `.text`, which is what `toText` returns.
 *
 * `toText` feeds this the whole document with every tag replaced by a space;
 * the browser feeds it text nodes joined end to end, because `word<em>s</em>`
 * is one word to whoever is selecting it. That difference is in the input, on
 * purpose. The whitespace rule itself lives here and nowhere else.
 */
export function flatten(raw: string): { text: string; from: number[] } {
  let text = "";
  const from: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (/\s/.test(raw[i])) {
      if (!text || text.endsWith(" ")) continue;
      text += " ";
    } else {
      text += raw[i];
    }
    from.push(i);
  }
  while (text.endsWith(" ")) {
    text = text.slice(0, -1);
    from.pop();
  }
  return { text, from };
}

/**
 * Where the Passage is now, or null if the quote is gone entirely — in which
 * case the Annotation is shown unanchored rather than dropped (ADR 0014).
 */
export function resolve(flatText: string, anchor: Anchor): number | null {
  if (!anchor.quote) return null;

  const hits: number[] = [];
  for (let at = flatText.indexOf(anchor.quote); at !== -1; at = flatText.indexOf(anchor.quote, at + 1)) {
    hits.push(at);
  }
  if (hits.length === 0) return null;

  // The same words twice over. Whichever copy still has the recorded words
  // around it is the one the Passage was taken from; a tie falls back to the
  // position, which is only ever a hint.
  let best = hits[0];
  let bestScore = -1;
  for (const at of hits) {
    const before = flatText.slice(Math.max(0, at - anchor.prefix.length), at);
    const after = flatText.slice(at + anchor.quote.length, at + anchor.quote.length + anchor.suffix.length);
    const score = tailMatch(before, anchor.prefix) + headMatch(after, anchor.suffix);
    const closer = Math.abs(at - anchor.start) < Math.abs(best - anchor.start);
    if (score > bestScore || (score === bestScore && closer)) {
      best = at;
      bestScore = score;
    }
  }
  return best;
}

/** Characters of `want` that match at the end of `have`, counting backwards. */
function tailMatch(have: string, want: string): number {
  let n = 0;
  while (n < want.length && n < have.length && have[have.length - 1 - n] === want[want.length - 1 - n]) n++;
  return n;
}

/** Characters of `want` that match at the start of `have`. */
function headMatch(have: string, want: string): number {
  let n = 0;
  while (n < want.length && n < have.length && have[n] === want[n]) n++;
  return n;
}
