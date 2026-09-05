---
status: accepted — supersedes ADR 0002, amends ADR 0001 and ADR 0010
---

# Ask is a real, streaming Claude session with read-only access to the Workspace

ADR 0002 held that the app never opens a Claude session: every job is `claude -p`, stateless, seconds not minutes, and anything conversational queues to the terminal. That line was drawn around grading, where it still holds. Ask breaks it deliberately. A learner who selects a paragraph and asks what it means wants an answer while the paragraph is in front of them, and wants to ask again; queueing that to the next terminal session is not a smaller version of the feature, it is the absence of it.

So Ask runs on `@anthropic-ai/claude-agent-sdk`: `query()` streaming `SDKMessage`s, one session per Lesson, resumed by id so follow-ups continue the same thread. The SDK spawns a Claude Code subprocess and authenticates as the CLI already does, so this stays on the learner's subscription — ADR 0002's "free at the margin" survives the change it otherwise overturns. Rejected `@anthropic-ai/sdk` (the Client SDK): a better streaming API, bought with per-token API-key billing and the loss of Workspace-aware tooling. Rejected hand-rolling `--output-format stream-json` over the existing `spawn`: no new dependency, but the app then owns NDJSON framing, partial-message assembly and session resume forever.

**Tools: Read, Glob and Grep only, `cwd` set to the Workspace.** This is what makes Claude teach from the learner's own notes rather than from whatever the app remembered to inline — it opens `MISSION.md`, the Working notes, the Notes on this Lesson and its neighbours, and the struggle log, and decides for itself what matters. ADR 0010's zero-tools rule was sized for grading one Probe and stays true there. No write tool: the app owns every write to a Note, so a session driven partly by text selected off a rendered page has no path to modify the Workspace.

**What Ask still may not do,** narrowing ADR 0001 rather than abandoning it: it is scoped to a Passage the learner is looking at, and it authors no Lesson, Probe, Palace or learning record, and decides nothing about what comes next. ADR 0001's boundary was never "the app may not explain" — it was "the app is not a rebuild of `/teach` as a web chat". That is the line to hold.

**The grader stays blind to Notes.** A Note under a Passage frequently restates it, sometimes verbatim from a kept Ask answer; inlining that alongside the source would have the grader judging a free-recall answer against a text that already contains it, and completeness would stop meaning anything. Grading keeps ADR 0010's envelope exactly as it is.
