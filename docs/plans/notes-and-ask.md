# Plan — Notes, Annotations and Ask

Build spec for four features, decided in a grilling session on 2026-09-04. Nothing
here is implemented yet. Read `CONTEXT.md` first for the vocabulary — this document
uses **Note**, **Annotation**, **Passage**, **Anchor** and **Ask** in their defined
senses, and `NOTES.md` always means `/teach`'s **Working notes**, never the student's.

The four features:

1. A Note per Lesson, with a panel beside the Lesson and an index on the Workspace page.
2. Select a Passage, ask Claude about it, streaming, in a thread that lasts the Lesson.
3. Select a Passage, write an Annotation on it — or keep an Ask answer as one.
4. Claude teaches from the student's Notes.

Feature 4 needs almost no code: the Ask session reads the files itself (ADR 0015), and
the terminal `/teach` session is told to read them by the contract (ADR 0016).

## Decisions already made — do not relitigate

| # | Decision | Recorded in |
| --- | --- | --- |
| 1 | A Note is student-owned, one Markdown file per Lesson. `NOTES.md` keeps its `/teach` meaning. | ADR 0013 |
| 2 | The Lesson is served raw and wrapped in a same-origin iframe. React reframing is impossible — it kills `<script>` and collides on CSS. | ADR 0014 |
| 3 | Anchors are quote + prefix/suffix + character position, resolved quote-first. | ADR 0014 |
| 4 | Anchors ride in HTML comments in the Note and double as entry delimiters. | ADR 0013 |
| 5 | The app writes the Note; the UI edits it; the student is not expected to open the file. | ADR 0013 |
| 6 | Ask is a real streaming Claude session, not a one-shot. | ADR 0015 |
| 7 | Via `@anthropic-ai/claude-agent-sdk`, on the CLI's subscription OAuth. Not the Client SDK — that bills per token. | ADR 0015 |
| 8 | The session gets Read, Glob, Grep, `cwd` = the Workspace. No write tool. | ADR 0015 |
| 9 | Two actions: **Ask** (streaming thread, keep-worthy answers saved) and **Annotation** (your own words, no Claude). | ADR 0015 |
| 10 | One Ask session per Lesson, resumed by id. | ADR 0015 |
| 11 | Panel beside the Lesson + a Notes section on the Workspace page. No separate explorer page. | this document |
| 12 | An Annotation whose Anchor no longer resolves is shown unanchored, never dropped. | ADR 0014 |
| 13 | The contract is re-synced from the template on every Workspace-page view. | ADR 0016 |
| 14 | Ask may explain a Passage; it authors no Lesson, Probe, Palace or record. | ADR 0015 |
| 15 | The grader never sees Notes. `lib/claude.ts` grading is untouched. | ADR 0015 |
| 16 | Three PRs, in the order below. | this document |
| 17 | A `/update-learnapp` project slash command brings an installation forward. | this document |

## Hard constraints

**Backward compatibility is a requirement, not a goal.** Every existing Workspace
(`c-sharp`, `italiano`, `guitarra`) must keep working with no migration step and no
manual action:

- A missing `notes/` directory means a Workspace with no Notes, not an error. Create it
  lazily on the first write.
- A missing `.learn/ask-sessions.jsonl` means no Ask has happened yet.
- Every loader returns empty on `ENOENT`, following `listLessons` and `openStruggles`.
- Add `notes` to the `create()` mkdir list for new Workspaces, but let nothing depend on
  it existing.
- No version file, no migration script, no upgrade path to maintain.

**Repo policy.** `main` is the only branch and pull requests into it belong to the user.
Work on a feature branch per PR, push, and hand it over — do not open the PR.

## Layout

```
lib/notes.ts                                  new — parse, serialise, load, save, list
lib/anchor.ts                                 new — pure Anchor search, no DOM
lib/ask.ts                                    new — the Agent SDK session
app/ws/[ws]/lesson/[...path]/page.tsx         new — the wrapper page (replaces route.ts here)
app/ws/[ws]/lesson/[...path]/LessonReader.tsx new — client: iframe, selection, highlights, panel
app/api/ws/[ws]/raw/[...path]/route.ts        moved from app/ws/[ws]/lesson/[...path]/route.ts
app/api/ws/[ws]/notes/[lesson]/route.ts       new — GET, PUT
app/api/ws/[ws]/ask/route.ts                  new — POST, streams NDJSON
app/ws/[ws]/page.tsx                          changed — Notes section, contract sync
lib/workspace.ts                              changed — syncContract, listNotes, notes/ in create
templates/CLAUDE.md                           changed — the Notes clause
lib/i18n.ts                                   changed — new chrome strings
lib/selfcheck.test.ts                         changed — two new tests
.claude/commands/update-learnapp.md           new
```

The route move is forced: Next.js will not let `route.ts` and `page.tsx` share a path.

Relative paths keep resolving after the move — a Lesson at
`/api/ws/c-sharp/raw/lessons/0001-x.html` loads `../assets/course.css` as
`/api/ws/c-sharp/raw/assets/course.css`, which the same route serves. Two consequences
to handle rather than discover:

- Sibling links inside the iframe (`0002-y.html`, `../reference/x.html`) navigate the
  iframe itself, so the panel must re-key on the iframe's `load` event by reading
  `contentWindow.location.pathname`. A reference document has no Note; show the panel empty
  and disable the actions rather than 404ing.
- `href="../MISSION.md"` already 415s today, because `.md` is not in the route's `TYPES`
  map. Pre-existing, unrelated, and a one-line fix if you want it — say so if you take it.

## The Note file

`workspaces/<ws>/notes/<lesson-basename>.md`, mirroring the Lesson filename:
`lessons/0001-int-is-not-number.html` -> `notes/0001-int-is-not-number.md`.

```markdown
# Notes — 0001 int is not number

<!-- a {"id":"k3f9","at":"2026-09-04T18:22:10Z","kind":"note","quote":"the extra bits are thrown away","prefix":"outgrows the box ","suffix":" without a word","start":1412,"end":1443} -->
> the extra bits are thrown away

This is the bit that breaks my JS intuition — no exception, no widening, just wrap.

<!-- a {"id":"k4a1","at":"2026-09-04T18:31:02Z","kind":"ask","quote":"checked arithmetic","prefix":"C# calls this ","suffix":" and it is off","start":2044,"end":2062} -->
> checked arithmetic

**Q:** why is this off by default?

**A:** Because the check costs an instruction on every arithmetic operation …
```

Rules:

- The preamble (everything before the first marker) is preserved verbatim on save. Generate
  it once, on file creation, as `# Notes — <lesson title or basename>`.
- One marker line per Annotation: `<!-- a {json} -->`, matched by `/^<!-- a (\{.*\}) -->$/m`.
  Split on it; everything up to the next marker or EOF is that Annotation's body.
- The quote appears twice on purpose — as a blockquote for the human and for Claude reading
  the file, and inside the JSON for anchoring. They are allowed to diverge; the JSON is
  authoritative for anchoring, the blockquote for reading.
- A body with no preceding marker is free prose. Keep it, round-trip it, do not anchor it.
- A malformed marker degrades to free prose. Never throw while parsing a Note — a parse
  error must not be able to cost someone their writing.

## Anchoring

`type Anchor = { quote: string; prefix: string; suffix: string; start: number; end: number }`

Offsets are into the document's **normalised flat text**: concatenate every text node in
document order, skipping `<script>` and `<style>`, collapsing each whitespace run to a
single space. `lib/source.ts:toText` already does this normalisation for HTML strings —
match its behaviour exactly. **The single most likely bug in this feature is capture and
resolution normalising differently.** They must share one function.

`prefix` and `suffix` are up to 32 characters of flat text either side of the quote.

**Resolution**, on every load, in this order:

1. Find every occurrence of `quote` in the flat text.
2. None: the Annotation is unanchored. Stop.
3. One: take it.
4. Several: score each by how much of `prefix` matches backwards and `suffix` forwards; break
   remaining ties by distance from `start`.

**Keep the search pure and out of the DOM.** `lib/anchor.ts` exports
`resolve(flatText: string, anchor: Anchor): number | null` — a character offset or null. That
is server-testable with plain strings and is where the two new tests go. The DOM half lives in
the client component: a `TreeWalker(NodeFilter.SHOW_TEXT)` pass that builds the flat text and
a parallel array of `{node, flatStart}`, used both to compute offsets on capture and to map an
offset back to a `Range` on resolution.

**Painting.** CSS Custom Highlight API — no DOM mutation, which is the point (ADR 0014):

```js
const doc = iframe.contentDocument;
doc.defaultView.CSS.highlights.set("annotation", new Highlight(...ranges));
doc.defaultView.CSS.highlights.set("annotation-focus", new Highlight(focusRange));
```

`::highlight(annotation)` styling must be injected into the iframe document as a
`<style>` element — the parent page's stylesheet does not reach inside. That single style
element is the only thing the app adds to the document, and it adds no marks to the text.
Baseline since June 2025; if `CSS.highlights` is undefined, skip painting and keep everything
else working rather than failing the page.

**Capture.** `iframe.contentWindow.getSelection()`, `getRangeAt(0)`, walk to
`startContainer`/`endContainer` through the same index to get flat offsets, `range.toString()`
for the quote. Ignore a collapsed selection. Ignore a selection that crosses out of the
document body.

## PR 1 — Notes, Annotations and the reader. No Claude.

Everything in this PR works with `claude` uninstalled, because Annotation is the zero-Claude
action. That is the point of the seam: it ships and it is usable on its own.

**`lib/notes.ts`**

```ts
export type Anchor = { quote: string; prefix: string; suffix: string; start: number; end: number };
export type Annotation = { id: string; at: string; kind: "note" | "ask"; anchor: Anchor; body: string };
export type Note = { preamble: string; annotations: Annotation[] };

export function parseNote(md: string): Note;            // pure, never throws
export function serialiseNote(note: Note): string;       // pure, round-trips parseNote
export function notePath(ws: string, lesson: string): string;
export function loadNote(ws: string, lesson: string): Promise<Note>;   // ENOENT -> empty
export function saveNote(ws: string, lesson: string, note: Note): Promise<void>;
```

`lesson` is the Lesson's basename without extension, validated against the same slug
discipline `lib/paths.ts` applies to Workspace names — it arrives from a URL. Reuse
`inWorkspace` for the path so traversal is refused the way it already is everywhere else.

`saveNote` writes to a temporary file in the same directory and renames over the target, so a
crash mid-write cannot truncate someone's Notes. `mkdir` the `notes/` directory first.

**`lib/anchor.ts`** — `resolve(flatText, anchor)` and the shared normaliser, per the section
above. No imports from `node:fs`, no DOM types: this file must run in both halves.

**`app/api/ws/[ws]/notes/[lesson]/route.ts`** — `GET` returns the parsed Note; `PUT` accepts a
whole Note and writes it. Whole-file PUT rather than per-Annotation verbs: the file is small,
there is one user, and it keeps the client's mutation logic in one place. Validate the body
shape before writing — this is a trust boundary even on localhost.

**`app/ws/[ws]/lesson/[...path]/page.tsx`** — server component. Resolve the Lesson path,
`notFound()` on anything that is not a served type, load the Note, render `LessonReader`.

**`LessonReader.tsx`** — client component:

- iframe pointing at `/api/ws/{ws}/raw/{path}`, panel beside it.
- On iframe `load`: build the text index, inject the highlight stylesheet, resolve every
  Anchor, paint.
- On `selectionchange` inside the iframe: show a small toolbar near the selection with
  **Note** (and, after PR 2, **Ask**).
- Panel lists Annotations in document order, unanchored ones pinned at the top with a marker
  saying the passage moved. Click scrolls the iframe to the Annotation and paints
  `annotation-focus`. Each entry can be edited in place and deleted.
- Re-key on iframe navigation, as described in Layout.

**`app/ws/[ws]/page.tsx`** — a `Notes` section using the existing `panel` / `plain` markup,
listing Lessons that have a Note and how many Annotations each holds, linking to the reader.
`listNotes(ws)` in `lib/workspace.ts` alongside `listLessons`.

**Tests** — in `lib/selfcheck.test.ts`, matching the existing style. Two, and only two, because
the existing suite already covers scheduling, replay, interleaving, source slicing and locale:

- A Note survives a parse/serialise round-trip, including free prose with no marker and one
  malformed marker.
- `resolve` picks the right occurrence when a quote appears twice, using prefix and suffix, and
  returns null when the quote is gone.

**i18n** — every new chrome string goes in `lib/i18n.ts` with both `en` and `es`. `es` is typed
against `en`, so a missing key is a compile error. Claude's output is never in this file.
Roughly: `notes`, `noNotesYet`, `addNote`, `askClaude`, `passageMoved`, `editNote`,
`deleteNote`, `noteCount(n)` (needs plural agreement in both languages — there is already a
test that enforces this for counted strings).

**Acceptance.** Select a passage in a real Lesson in `workspaces/guitarra`, write an
Annotation, reload the page, see the highlight in place and the entry in the panel. Open the
Workspace page and see the Lesson listed under Notes. Confirm `fretboard.js` still runs inside
the iframe — that is the whole reason for ADR 0014, and it is the thing to actually look at
rather than assume.

## PR 2 — Ask

**Dependency.** `npm install @anthropic-ai/claude-agent-sdk`. It spawns a Claude Code
subprocess and uses the CLI's own OAuth, so this stays on the subscription. Do not reach for
`@anthropic-ai/sdk`, which is a different package and bills per token.

**`lib/ask.ts`** — wraps `query()`. Keep it separate from `lib/claude.ts`: that file is the
grading envelope (ADR 0010) and it does not change in this PR.

```ts
query({
  prompt,
  options: {
    cwd: wsDir(ws),
    resume: sessionId,              // undefined for the first Ask on this Lesson
    allowedTools: ["Read", "Glob", "Grep"],
    includePartialMessages: true,
    maxTurns: 8,
  },
})
```

**Confirm every option name against the TypeScript reference before writing this file**
(`code.claude.com/docs/en/agent-sdk/typescript`). Verified from the docs: `resume`,
`resumeSessionAt`, `forkSession`, `maxTurns`, `includePartialMessages`, `persistSession`.
*Not* verified, and to be checked: `cwd`, `allowedTools`, `permissionMode`, and how the system
prompt is passed. Do not infer them.

**One risk to close deliberately:** the SDK loads skills, commands and memory from the project
and from `~/.claude/`, and the Workspace's `CLAUDE.md` is a contract instructing Claude to
write Probes and Palaces. An Ask session must not start authoring. Check what the SDK's setting
sources actually load, and either exclude project settings for Ask or override them in the Ask
system prompt. Ask's whole boundary (ADR 0015) is that it explains a Passage and authors
nothing.

**System prompt.** Short, in the house style of `GRADER` in `lib/claude.ts`. It should say: you
are answering a question about a passage the learner selected; you may read the Workspace to
ground yourself — the mission, the working notes, their own Notes, their struggle log — and you
must not write files, author lessons or probes, or decide what they learn next. Answer in the
language of the Lesson.

**Session storage.** `.learn/ask-sessions.jsonl`, append-only, folded last-wins:
`{"t":"<ISO8601>","lesson":"0001-int-is-not-number","session":"<uuid>"}`. A JSON map would be
simpler and would be the only mutable file in `.learn/`; ADR 0011 makes every log there
append-only so that two writers never need a lock. Follow it. `lib/jsonl.ts` already has
`append` and `read`.

**`app/api/ws/[ws]/ask/route.ts`** — `POST {lesson, question, anchor}`, returns a
`ReadableStream` of NDJSON, one JSON object per line (`{type, text}`). Not SSE: the request is
a POST, so `EventSource` is out, and the client reads it with `body.getReader()` and a
`TextDecoder`. Append the session id to the log as soon as the SDK reports it. On failure,
stream a final error object — do not leave the client hanging.

Failure posture matches ADR 0010's: no degraded mode. Claude unreachable means Ask says so and
offers a retry. It must not take down the rest of the reader — Annotations keep working, which
is what PR 1 being independent buys you.

**UI.** The Ask thread lives in the same panel, on its own tab beside the Annotation list.
Streaming text renders as it arrives. Each answer gets a **Keep** button that writes it into
the Note as an Annotation with `kind: "ask"`, anchored to the Passage the question was about,
body formatted as the `**Q:** / **A:**` pair shown above. Nothing is saved without that click
(decision 9) — the Note is notes, not a transcript.

**Acceptance.** Select a passage, ask a question, watch it stream. Ask a follow-up that only
makes sense with the first answer in context and confirm the thread carried. Reload the page
and confirm the thread rehydrates. Keep an answer and confirm it lands in the Note file
correctly anchored. Ask something that requires Claude to have read `MISSION.md` or the Working
notes and confirm it actually did.

## PR 3 — The contract, the command, the docs

**`templates/CLAUDE.md`** — a Notes clause, in the voice of the existing file. It should say:
`notes/<lesson>.md` is the learner's own writing about that Lesson — what they highlighted,
what confused them, what they asked. Read it before teaching, alongside the Struggles. It is
theirs: never rewrite it, never append to it. Notes are context, not a queue — there is nothing
to drain and no event to append. Add the file to the ownership table with the learner as owner.

**`lib/workspace.ts`** — `syncContract(ws)`, called from `app/ws/[ws]/page.tsx` beside
`syncPlaces(ws)` (ADR 0016). Compare the template against the Workspace's copy and write only
when they differ, so a page view does not churn mtimes.

**`.claude/commands/update-learnapp.md`** — the project slash command. Run `claude` in the
repo root, type `/update-learnapp`. It should:

1. Refuse on a dirty working tree, and say what is dirty. Do not stash — the uncommitted work
   might be the user's.
2. `git pull`, and stop and explain if it conflicts rather than resolving unasked.
3. `npm install`.
4. `npm test`, then `npm run build`. Report failures with the actual output.
5. Report what changed since the previous revision: new ADRs, contract changes, new
   dependencies.
6. Say plainly that `workspaces/` and `PLACES.md` are gitignored and were not touched, and
   that each Workspace's `CLAUDE.md` refreshes itself the next time its page is opened.

**`README.md`** — Notes and Ask in "The daily loop" and the diagram, `notes/` in the Layout
tree, `/update-learnapp` in a short "Updating" section, and the new ADRs in "Why it looks like
this".

**Acceptance.** Open each of the three existing Workspaces' pages and confirm the contract
file updated in place with no other change to the Workspace. Run `/update-learnapp` on a clean
tree and on a dirty one, and confirm the dirty case refuses instead of stashing.
