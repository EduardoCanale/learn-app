# This workspace

A `/teach` workspace wrapped by a local review app. You teach here; the app
handles spaced repetition and memory palaces. Everything below is the contract
between the two. Follow it whenever you work in this directory.

## Start every session by draining Struggles

`.learn/struggles.jsonl` is a log of things the learner got wrong during review
in a way that showed the underlying model was wrong, not merely unretrieved.

Read it. It is an append-only event log — fold it: a `probe` with an `opened`
and no later `closed` is still open.

Then, before teaching anything new:

1. **Cluster them.** Three failures around the same confusion are one gap, not
   three. Say which ones you have grouped and why.
2. **Teach the most load-bearing cluster**, as a normal lesson.
3. **Append a `taught` event** for each Probe in the cluster:
   `{"t":"<ISO8601>","event":"taught","probe":"0007-2"}`

Never append `closed`. The app closes a Struggle only when the Probe that
generated it is next answered correctly — teaching is not learning.

Never write to `.learn/reviews.jsonl`. That file is the app's.

## Give every lesson section a stable id

Probes point at a specific section, like
`lessons/0007-ownership-moves.html#moves`, and the app inlines only that
section when explaining a mistake. So every section heading in a lesson needs a
stable `id`:

```html
<h2 id="moves">What a move actually does</h2>
```

Ids must not change once written — a Probe pointing at a missing id degrades
to the whole lesson.

## Write Probes alongside every lesson

For `lessons/0007-ownership-moves.html`, write `probes/0007.json`:

```json
[
  {
    "id": "0007-1",
    "prompt": "From memory: you pass a String by value into a function. Walk through what happens to the caller's binding, and why the language works that way.",
    "source": "lessons/0007-ownership-moves.html#moves"
  }
]
```

Three to eight per lesson. Rules for the prompt:

- **Demand generation, not recognition.** There is no answer side to flip to.
  The learner types from memory and Claude grades it against `source`. So ask
  for explanation, reconstruction, prediction, or a walked-through mechanism —
  never something answerable with a word the prompt already hints at.
- **Ask "why" and "what breaks if not" at least as often as "what".**
- **One idea per Probe**, anchored at the section that answers it.
- **Ground it in the mission.** A Probe the learner cannot connect to why they
  are here is a Probe they will resent.

## Build a Palace only for enumerable material

Memory palaces are strong for ordered, enumerable sets and weak for conceptual
understanding. So build one only when a lesson contains a genuine sequence,
taxonomy, or fixed set of rules — the six phases of X, the four kinds of Y.
Never for "understand how Z works". That stays with ordinary Probes.

When one is warranted:

1. Read `PLACES.md` in this directory. It lists the learner's real Routes, each
   marked `CLAIMED` or `free`. **Only ever use a free Route.** The app maintains
   those marks; do not edit them. If none is free, say so and skip the Palace.
2. Write `palaces/<slug>.json`:

```json
{
  "id": "borrow-phases",
  "title": "The six phases of the borrow checker",
  "route": "Flat",
  "loci": [
    {
      "locus": "front door mat",
      "image": "a library book chained to the mat, a dozen hands reading it at once",
      "encodes": "Shared borrow: many readers, no writer"
    }
  ]
}
```

3. Images must be vivid, concrete, and absurd enough to be unforgettable. Use
   the learner's own Route wording for `locus`, verbatim. Keep `loci` in the
   order the Route is walked — the order is part of what gets recalled.

The app turns each Palace into one Walk on the same review queue as Probes.
There is no separate palace schedule.

## Read their Notes before you teach

`notes/<lesson>.md` is the learner's own writing about that lesson: the passages
they highlighted, what they made of them, and the answers they kept from asking
about them while reading. One file per lesson, mirroring its name.

Read them at the start of a session, next to the Struggles, and read the one for
a lesson before you revise it. A Struggle tells you they got something wrong. A
Note tells you what they thought was going on, which is usually the more useful
half.

They are theirs. Never rewrite one, never append to one, never tidy one up. If a
Note has something wrong in it, correct it by teaching, not by editing the file.

Notes are context, not a queue. There is nothing to drain and no event to append
— unlike `.learn/struggles.jsonl`, reading a Note leaves nothing behind.

## Files

| Path | Owner | Notes |
| --- | --- | --- |
| `MISSION.md`, `lessons/`, `reference/`, `learning-records/`, `assets/` | you | Standard `/teach` |
| `CLAUDE.md` | the app | This file, rewritten from the template on every workspace-page view |
| `probes/*.json` | you | One file per lesson, named by its number |
| `palaces/*.json` | you | Enumerable material only |
| `notes/*.md` | the learner | Read before teaching. Never write |
| `PLACES.md` | the app | Read it, never edit it |
| `.learn/struggles.jsonl` | shared | You append `taught` only |
| `.learn/reviews.jsonl` | the app | Never write |

Both `.learn/` logs are append-only. Never rewrite one — the app may be
appending at the same moment.
