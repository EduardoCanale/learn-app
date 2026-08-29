# Learn

A local web app over the [`/teach`](https://github.com/mattpocock/skills) skill. Claude teaches
in the terminal; this remembers for you.

`/teach` is very good at producing a lesson and very bad at making sure you still know it in
three weeks. This fills that half: spaced repetition over free-recall questions, graded by
Claude, plus memory palaces for the material that actually suits them.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Add an alias if you want the short version:

```bash
alias learn='cd ~/Study/learn-app && npm run dev'
```

Nothing runs in the background and nothing notifies you. Adherence is a habit, not a daemon.

## How it fits together

```
terminal                          browser
--------                          -------
cd workspaces/rust && claude      npm run dev
  /teach                            recall session
  reads .learn/struggles.jsonl      free-recall probe, typed from memory
  teaches the gaps first              |
  writes lessons + probes/          claude -p (sonnet, no tools)
        |                             |
        +------ shared files ------ verdict: complete? retrieval or comprehension?
                                      |
                            +---------+---------+
                       retrieval            comprehension
                       hints until you      explanation + the source section
                       say it yourself      + a rephrased question you must pass
                            |                     |
                            +---------+-----------+
                                      |
                              FSRS reschedules
                              comprehension -> struggle queued for next session
```

Two rules keep it coherent:

- **Claude teaches, the app remembers.** Lessons, probes, palaces and clustering are Claude's.
  Scheduling, the review loop and the palace bookkeeping are the app's. The app never writes
  pedagogy.
- **Claude is only ever called one-shot.** `claude -p` with zero tools, structured JSON out,
  seconds not minutes. Anything needing a conversation queues to your terminal instead.

## Set-up

1. **Edit `PLACES.md`.** Write out a few real places you know cold as ordered walks. Memory
   palaces are built on these, and Claude cannot invent one for you. Twenty minutes, once.
2. **Create a topic** in the app, then run `/teach` inside it. Claude draws the mission out of
   you — the app deliberately can't.
3. Every workspace gets a `CLAUDE.md` that tells Claude how to write probes and drain
   struggles. It is scaffolded for you; keep it.

## Layout

```
learn-app/
  app/                Next.js pages and the two API routes
  lib/                scheduling, probe loading, the Claude call, log folding
  templates/CLAUDE.md the contract scaffolded into every workspace
  PLACES.md           your real routes, the source for every palace
  workspaces/         your topics (gitignored — this is your data)
    rust/
      MISSION.md lessons/ reference/ learning-records/ assets/   <- /teach
      probes/ palaces/                                           <- /teach, for this app
      .learn/reviews.jsonl .learn/struggles.jsonl                <- append-only logs
  docs/adr/           why it is built this way
  CONTEXT.md          the vocabulary
```

## Why it looks like this

Twelve decisions are written down in `docs/adr/`, most of them against the obvious
alternative. The short version:

- **Probes have no back.** Free recall beats cued recall on delayed retention, so a flippable
  card is the weaker instrument. ([ADR 0003](docs/adr/0003-free-recall-probes-not-flashcards.md))
- **A wrong answer isn't finished until you generate the right one.** Showing the answer lets
  high-confidence errors come back; being re-tested after the correction blocks them, and hints
  that make you produce it beat handing it over. ([ADR 0009](docs/adr/0009-failed-probes-must-close-by-self-generation.md))
- **Palaces only for enumerable material.** Loci is well evidenced for ordered sets and thin
  for concepts. ([ADR 0007](docs/adr/0007-palace-is-for-enumerable-material-only.md))
- **State is plain files, not SQLite** — so Claude can read your actual failure history when
  choosing the next lesson. ([ADR 0006](docs/adr/0006-all-state-as-plain-files-in-the-workspace.md))
- **No Claude, no review.** A degraded offline mode is a second product, and delayed feedback
  is weakest exactly for wrong answers. ([ADR 0010](docs/adr/0010-the-claude-call-envelope.md))

## Known weak joint

Probe authoring is instruction-following, not enforcement. A session can simply not write them.
The app detects lessons with no probes and surfaces them on the topic page, but it cannot make
the contract binding.

## Tests

```bash
npm test
```

Covers the parts that would break silently: the verdict-to-FSRS mapping, replaying the review
log into card state, session interleaving, and anchored section extraction.
