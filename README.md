# Learn

A local web app over the [`/teach`](https://github.com/mattpocock/skills) skill. Claude teaches
in the terminal; this remembers for you.

`/teach` is very good at producing a lesson and very bad at making sure you still know it in
three weeks. This fills that half: spaced repetition over free-recall questions, graded by
Claude, plus memory palaces for the material that actually suits them.

## What you need

- **Node 22.18+**, or 24+. The tests run through Node's own TypeScript stripping, on by
  default only from 22.18.
- **macOS or Linux.** The app spawns `claude` by name.
- **This repo** — `git clone git@github.com:EduardoCanale/learn-app.git` — and a network
  connection the first time you start it, for the fonts.
- **Claude Code 2.1.169 or newer**, logged in. Check with `claude --version`. Grading is one
  `claude -p --model sonnet` call per answer, a few seconds each, and review blocks rather
  than degrading if it can't reach it.
- **The [`/teach`](https://github.com/mattpocock/skills) skill.**

  ```bash
  claude plugins install mattpocock-skills
  ```

  Or `npx skills@latest add mattpocock/skills` for editable copies. To check: start `claude`
  and type `/teach` — the two routes put the files in different places.

## First run

Once, in this order. Steps 1–2 are setup; step 3 onward is the loop you repeat forever.

**1. Install and start the app.**

```bash
npm install
npm run dev          # http://localhost:3000
```

Leave it running. It is a normal local web app — nothing runs in the background, nothing
notifies you.

**2. Write your places** in `PLACES.md`, at the repo root.

```bash
cp PLACES.example.md PLACES.md
```

`PLACES.md` is gitignored — it describes your home and your commute, so it stays out of the
repo and can never turn up in a pull request. The example is what's tracked.

Real places you know cold, each as an ordered walk of fixed positions. Memory palaces are
built on these and Claude cannot invent one for you. Twenty minutes, once — the file
explains the rules. Skip it and you lose palaces, not the rest of the app.

Every topic page re-reads the root file, so a Route you add next month reaches the
workspaces that already exist.

**3. Create a topic in the browser.** Open http://localhost:3000, type a name (`rust`),
hit Create. That scaffolds `workspaces/rust/` with the folders, the teaching contract
(`CLAUDE.md`) and a copy of your places.

**4. Teach it, in a terminal.** The app deliberately cannot do this part — Claude draws the
mission out of you in conversation.

```bash
cd workspaces/rust
claude
/teach
```

The session writes `MISSION.md`, lessons, and the probes that become your review queue.

**5. Recall it, back in the browser.** Refresh http://localhost:3000. The topic now shows
probes due. Hit **Recall** and type each answer from memory — no card to flip. Claude grades
it against the lesson, hints until you produce it yourself, and reschedules.

Chrome is English or Spanish, toggle bottom right. Lessons and grading stay in the
material's own language.

## The daily loop

Both, but not for the same thing:

| You want | Where | What |
| --- | --- | --- |
| New material, or a gap taught properly | terminal, inside `workspaces/<topic>` | `claude` then `/teach` |
| To keep what you already learned | browser | `npm run dev`, hit Recall |
| To know which you need | browser | the home page says what's due |

Run `/teach` when you want to move forward. Review in the browser whenever something is due
— that is most days, and it is the half `/teach` alone cannot do.

The two halves talk through files in the workspace, so **restart nothing**: a `/teach`
session writing lessons shows up on a browser refresh, and failures you hit in review are
queued for Claude to teach at the start of your next session.

Short version of the app command, if you want it:

```bash
alias learn='cd /path/to/learn-app && npm run dev'
```

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

## Layout

```
learn-app/
  app/                Next.js pages and the two API routes
  lib/                scheduling, probe loading, the Claude call, log folding, i18n
  templates/CLAUDE.md the contract scaffolded into every workspace
  PLACES.example.md   the starting point for your routes
  PLACES.md           your real routes (gitignored — this is your data)
  workspaces/         your topics (gitignored — this is your data)
    rust/
      MISSION.md RESOURCES.md NOTES.md lessons/ reference/       <- /teach
      learning-records/ assets/                                  <- /teach
      probes/ palaces/                                           <- /teach, for this app
      CLAUDE.md PLACES.md                                        <- the app
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

Covers the parts that would break silently: the verdict-to-FSRS mapping, replaying
the review log into card state, session interleaving, anchored section extraction, and the
locale fallback and plural agreement behind the language toggle.

## License

MIT — see [LICENSE](LICENSE).
