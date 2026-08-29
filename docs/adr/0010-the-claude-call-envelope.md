# How the app calls Claude: Sonnet, zero tools, stateless, and it blocks when unreachable

Three choices that together define the app's only outward-facing surface.

**Sonnet 5 for every job.** Grading free recall against source material, and separating a Retrieval failure from a Comprehension failure, is a subtle judgement — and it is the judgement that routes everything downstream, so a misdiagnosis hands you hints when you needed an explanation. Haiku is weakest exactly there. Opus buys little beyond Sonnet for this and costs 4-8s per call, which is dead time in a session that already has 20+ calls. Rejected splitting models by job: it optimises the cheap half while leaving the routing decision on the cheap model.

**Zero tools.** The app reads the Probe's anchored source section itself and inlines it in the prompt, so `claude -p` runs with no Read, no Bash, nothing. No permission prompts, no file-access surface, faster calls. Inlining the *anchored section* rather than the whole lesson keeps a day's review around 70k input tokens instead of five to ten times that.

**Stateless, even through a Scaffold.** A hint ladder is conceptually a conversation, but its state — the Probe, the source, answers so far, hints so far — is a few hundred tokens. Passing it in each call beats managing session resume, and keeps ADR 0002's rule intact.

**Block when unreachable.** No Claude means no review; the app says so and offers a retry. A review without diagnosis or scaffolding is a different and worse product, and building it means maintaining a second code path forever. Deferred grading was tempting, since the retrieval itself works offline — but immediate feedback is what optimises error correction, while delayed feedback mainly helps items already answered correctly. Errors are the whole point of the failure loop, so deferring guts it.
