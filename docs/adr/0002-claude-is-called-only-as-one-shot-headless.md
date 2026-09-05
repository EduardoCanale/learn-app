---
status: superseded by ADR 0015 — still true of grading; Ask is a real session
---

# The app calls Claude only as one-shot headless invocations

Review needs intelligence: a lapse is either a Retrieval failure or a Comprehension failure, and the two deserve different responses. Only Claude can tell them apart from a free-recall answer. But letting the app hold a Claude *session* drags in streaming, resume, permission prompts and long-running job UI — the browser-drives-everything design we rejected.

So the app shells out to `claude -p` with structured JSON in and out, for a bounded set of jobs: grade a recall answer, classify the failure mode, emit a Repair. Stateless, seconds not minutes, no conversation. Anything that needs real teaching — a remedial lesson — is queued to the next terminal session instead. This uses the same subscription OAuth as the terminal, so it is free at the margin.

The line to hold: if a job needs conversation or takes minutes, it queues. It does not become a session.
