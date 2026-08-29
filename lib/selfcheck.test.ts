import { strict as assert } from "node:assert";
import test from "node:test";
import { Rating, State } from "ts-fsrs";

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
