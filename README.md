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

Chrome is English or Spanish, and light, dark or whatever your OS says. Both toggles sit
bottom right; each is remembered. Lessons and grading stay in the material's own language.

## The daily loop

Both, but not for the same thing:

| You want | Where | What |
| --- | --- | --- |
| New material, or a gap taught properly | terminal, inside `workspaces/<topic>` | `claude` then `/teach` |
| To keep what you already learned | browser | `npm run dev`, hit Recall |
| To know which you need | browser | the home page says what's due |
| To read a lesson and write on it | browser | open the lesson, select a passage, **Note** |
| To ask what a passage means | browser | select it, **Ask** — a thread that lasts the lesson |

Run `/teach` when you want to move forward. Review in the browser whenever something is due
— that is most days, and it is the half `/teach` alone cannot do.

Notes are yours. They live in `workspaces/<topic>/notes/<lesson>.md`, one file per lesson,
and the contract tells Claude to read them before teaching you anything else — so what
confused you on Tuesday is in front of it on Thursday. Ask is a real Claude session with
read-only run of the workspace, so it answers about the passage in front of you knowing
your mission and what you have already got wrong. It cannot write a lesson, a probe or a
note; keeping an answer is a button you press.

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
  /teach                            recall session, and the lesson reader
  reads .learn/struggles.jsonl      free-recall probe, typed from memory
  teaches the gaps first              |
  writes lessons + probes/          claude -p (sonnet, no tools)
  reads notes/ before teaching        |
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

                                  reading a lesson
                                    select a passage
                                      |
                              +-------+-------+
                            Note              Ask
                            your words        a streaming Claude session,
                            straight to       read-only in the workspace
                            notes/            -> Keep writes it to notes/
```

Two rules keep it coherent:

- **Claude teaches, the app remembers.** Lessons, probes, palaces and clustering are Claude's.
  Scheduling, the review loop and the palace bookkeeping are the app's. The app never writes
  pedagogy.
- **Grading is only ever one-shot.** `claude -p` with zero tools, structured JSON out, seconds
  not minutes, and blind to your notes. Ask is the one deliberate exception, and it is scoped
  to the passage you selected: it explains, and it authors nothing.

## Layout

```
learn-app/
  app/                Next.js pages, the lesson reader, and the API routes
  lib/                scheduling, probes, the Claude calls, anchoring, notes, log folding, i18n
  templates/CLAUDE.md the contract, rewritten into every workspace on every page view
  PLACES.example.md   the starting point for your routes
  PLACES.md           your real routes (gitignored — this is your data)
  workspaces/         your topics (gitignored — this is your data)
    rust/
      MISSION.md RESOURCES.md NOTES.md lessons/ reference/       <- /teach
      learning-records/ assets/                                  <- /teach
      probes/ palaces/                                           <- /teach, for this app
      notes/0001-....md                                          <- you, through the app
      CLAUDE.md PLACES.md                                        <- the app
      .learn/reviews.jsonl .learn/struggles.jsonl                <- append-only logs
      .learn/ask-sessions.jsonl                                  <- which session each Ask thread is
  docs/adr/           why it is built this way
  docs/plans/         what was built, and what was left
  types/              the DOM declarations TypeScript is missing for the reader
  .claude/commands/   /update-learnapp, the updater below
  CONTEXT.md          the vocabulary
```

## Why it looks like this

Sixteen decisions are written down in `docs/adr/`, most of them against the obvious
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
- **A lesson is never modified to annotate it.** Rendering lesson HTML into React kills its
  scripts, so it is framed as-is and highlights are ranges, not markup.
  ([ADR 0014](docs/adr/0014-lessons-are-annotated-without-being-touched.md))
- **Ask is a real session, grading still is not.** A question about the paragraph in front of
  you is not the same job as grading one answer, and queueing it to the terminal is not a
  smaller version of the feature. ([ADR 0015](docs/adr/0015-ask-is-a-real-claude-session.md))
- **The contract is rewritten on every workspace-page view.** Scaffolding it once froze it at
  whatever the template said that day.
  ([ADR 0016](docs/adr/0016-the-workspace-contract-is-resynced-on-view.md))

## Known weak joint

Probe authoring is instruction-following, not enforcement. A session can simply not write them.
The app detects lessons with no probes and surfaces them on the topic page, but it cannot make
the contract binding.

## Updating

```bash
claude          # in the repo root
/update-learnapp
```

It refuses on a dirty tree rather than stashing your work, pulls, installs, runs the tests
and the build, and tells you what changed — new ADRs, contract changes, new dependencies.
`workspaces/` and `PLACES.md` are gitignored and are never touched; each workspace's
`CLAUDE.md` refreshes itself the next time you open its page.

## Tests

```bash
npm test
```

Covers the parts that would break silently: the verdict-to-FSRS mapping, replaying
the review log into card state, session interleaving, anchored section extraction, the note
file surviving a round trip through the parser, finding a passage again after the lesson
moved it, and the locale fallback and plural agreement behind the language toggle.

## License

MIT — see [LICENSE](LICENSE).
