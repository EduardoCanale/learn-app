# Struggles are clustered before teaching and close only on evidence

Three Comprehension failures around the same confusion are one gap, not three. So Struggles accumulate rather than each triggering a remedial lesson, and Claude clusters them at the start of a teaching session before deciding what is worth teaching. Clustering is a judgement about the material, which makes it Claude's under ADR 0001 — the app never groups them itself.

A Struggle is marked *taught* by Claude when it produces the lesson, but it is only *closed* by the app when the Probe that generated it is next answered correctly. Teaching is not learning; closing on "I explained it" is the same illusory-mastery trap `/teach` warns about when it separates coverage from evidence.

**Consequence for storage, and it resolves ADR 0006's concurrency worry:** `struggles.jsonl` is an append-only event log, not a mutable record. The app appends `opened`, Claude appends `taught`, the app appends `closed`; current state is derived by folding the log. Neither party ever rewrites a file the other is holding, so two writers need no locking. Every `.learn/` log follows this rule.
