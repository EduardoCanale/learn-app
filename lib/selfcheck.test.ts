import { strict as assert } from "node:assert";
import test from "node:test";
import { Rating, State } from "ts-fsrs";

import { resolve } from "./anchor.ts";
import { dict, toLocale } from "./i18n.ts";
import { parseNote, serialiseNote } from "./notes.ts";
import { interleave, isDue, ratingFor, replay, type ReviewEvent } from "./scheduler.ts";
import { sliceSection, toText } from "./source.ts";

test("verdict maps onto FSRS grades per ADR 0004", () => {
  const base = { hints: 0, comprehension: false } as const;
  assert.equal(ratingFor({ ...base, completeness: "complete" }), Rating.Good);
  assert.equal(ratingFor({ ...base, completeness: "partial" }), Rating.Hard);
  assert.equal(ratingFor({ ...base, hints: 1, completeness: "complete" }), Rating.Hard);
  assert.equal(ratingFor({ ...base, hints: 2, completeness: "complete" }), Rating.Again);
  assert.equal(ratingFor({ ...base, comprehension: true, completeness: "complete" }), Rating.Again);

  // Easy must stay unreachable: FSRS inflates intervals when it is applied liberally.
  const every = [0, 1, 2, 3].flatMap((hints) =>
    [true, false].flatMap((comprehension) =>
      (["complete", "partial"] as const).map((completeness) =>
        ratingFor({ hints, comprehension, completeness }),
      ),
    ),
  );
  assert.ok(!every.includes(Rating.Easy));
});

test("card state is a faithful fold of the review log", () => {
  const day = 86_400_000;
  const events: ReviewEvent[] = [
    { t: new Date(Date.now() - 3 * day).toISOString(), probe: "a", rating: 3, outcome: "correct", hints: 0 },
    { t: new Date(Date.now() - 2 * day).toISOString(), probe: "a", rating: 3, outcome: "correct", hints: 0 },
  ];
  const cards = replay(events, ["a", "b"]);

  assert.equal(cards.get("a")!.reps, 2);
  assert.equal(cards.get("a")!.state !== State.New, true);
  // An unreviewed Probe is new, and new Probes are due immediately.
  assert.equal(cards.get("b")!.state, State.New);
  assert.ok(isDue(cards.get("b")!));
});

test("replay ignores events for Probes that no longer exist", () => {
  const events: ReviewEvent[] = [
    { t: new Date().toISOString(), probe: "deleted", rating: 1, outcome: "correct", hints: 0 },
  ];
  assert.doesNotThrow(() => replay(events, ["a"]));
  assert.equal(replay(events, ["a"]).size, 1);
});

test("a session interleaves lessons instead of running them in blocks", () => {
  const items = [
    { source: "lessons/01.html#a" },
    { source: "lessons/01.html#b" },
    { source: "lessons/01.html#c" },
    { source: "lessons/02.html#a" },
    { source: "lessons/02.html#b" },
  ];
  const out = interleave(items);
  assert.equal(out.length, items.length);

  // Two 01s must end up adjacent since 01 outnumbers 02, but never three.
  const lessons = out.map((p) => p.source.split("#")[0]);
  for (let i = 2; i < lessons.length; i++) {
    assert.ok(
      !(lessons[i] === lessons[i - 1] && lessons[i] === lessons[i - 2]),
      `three in a row at ${i}: ${lessons.join(" ")}`,
    );
  }
});

test("a Probe's anchor pulls out its own section, not the whole lesson", () => {
  const html = `<html><body>
    <h2 id="intro">Intro</h2><p>Before.</p>
    <h2 id="moves">Moves</h2><p>Ownership transfers.</p><h3>Detail</h3><p>Still moves.</p>
    <h2 id="borrows">Borrows</h2><p>After.</p>
  </body></html>`;

  const section = toText(sliceSection(html, "moves"));
  assert.match(section, /Ownership transfers/);
  assert.match(section, /Still moves/, "a deeper heading stays inside the section");
  assert.doesNotMatch(section, /Before/);
  assert.doesNotMatch(section, /After/, "the next same-level heading ends the section");
});

test("a missing anchor degrades to the whole lesson rather than nothing", () => {
  const html = `<html><body><h2 id="intro">Intro</h2><p>Content.</p></body></html>`;
  assert.match(toText(sliceSection(html, "gone")), /Content/);
});

test("a Note round-trips, keeping free prose and a marker it cannot read", () => {
  const md = [
    "# Notes — 0001 int is not number",
    "",
    "Something I wrote before selecting anything.",
    "",
    '<!-- a {"id":"k3f9","at":"2026-09-04T18:22:10Z","kind":"note","quote":"thrown away",' +
      '"prefix":"the extra bits are ","suffix":" without a word","start":1412,"end":1423} -->',
    "> thrown away",
    "",
    "No exception, no widening, just wrap.",
    "",
    "<!-- a {not json} -->",
    "Which makes this prose, not an entry.",
    "",
  ].join("\n");

  const note = parseNote(md);
  assert.equal(note.annotations.length, 1);
  assert.equal(note.annotations[0].anchor.start, 1412);
  assert.match(note.preamble, /before selecting anything/, "prose above the first marker is kept");
  assert.match(note.annotations[0].body, /just wrap/);
  assert.match(
    note.annotations[0].body,
    /not an entry/,
    "a marker that will not parse costs nobody their writing",
  );

  assert.deepEqual(parseNote(serialiseNote(note)), note);
});

test("an Anchor finds the copy its context matches, and null once the quote is gone", () => {
  const flat = toText(
    "<p>The interval is three semitones and that is that.</p>" +
      "<p>Later the interval is three semitones on the sixth string.</p>",
  );
  const at = flat.lastIndexOf("three semitones");
  const anchor = {
    quote: "three semitones",
    prefix: flat.slice(at - 32, at),
    suffix: flat.slice(at + 15, at + 47),
    start: at,
    end: at + 15,
  };

  assert.equal(resolve(flat, anchor), at, "prefix and suffix pick the second copy");

  // The position is only a hint. Text moving in front of the Passage must not
  // hand the Annotation to the wrong copy.
  const moved = "One more sentence in front. " + flat;
  assert.equal(resolve(moved, anchor), moved.lastIndexOf("three semitones"));

  // With no context left, the hint is all there is.
  assert.equal(resolve(flat, { ...anchor, prefix: "", suffix: "" }), at);

  assert.equal(resolve("Nothing of the sort in here.", anchor), null);
});

test("an unrecognised locale cookie falls back to English", () => {
  assert.equal(toLocale("es"), "es");
  assert.equal(toLocale("en"), "en");
  assert.equal(toLocale("fr"), "en");
  assert.equal(toLocale(undefined), "en");
  assert.equal(toLocale("constructor"), "en", "a prototype key is not a locale");
});

test("counted strings agree on singular and plural in both languages", () => {
  assert.equal(dict.en.dueAcross(1, 1), "1 due across 1 topic");
  assert.equal(dict.en.dueAcross(2, 3), "2 due across 3 topics");
  assert.equal(dict.es.dueAcross(1, 1), "1 pendiente en 1 tema");
  assert.equal(dict.es.dueAcross(2, 3), "2 pendientes en 3 temas");
  assert.equal(dict.en.recallProbes(1), "Recall 1 probe");
  assert.equal(dict.es.recallProbes(1), "Recordar 1 prueba");
  assert.equal(dict.es.recallProbes(4), "Recordar 4 pruebas");
  assert.equal(dict.en.noteCount(1), "1 note");
  assert.equal(dict.en.noteCount(3), "3 notes");
  assert.equal(dict.es.noteCount(1), "1 apunte");
  assert.equal(dict.es.noteCount(3), "3 apuntes");
});
