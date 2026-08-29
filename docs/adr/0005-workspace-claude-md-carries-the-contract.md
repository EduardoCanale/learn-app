# The app's contract with Claude lives in a scaffolded per-workspace CLAUDE.md

`/teach` is installed from `mattpocock/skills` and pinned by folder hash in `~/.agents/.skill-lock.json`. Editing it in place would be silently overwritten by the next skill update, and forking it means giving up an actively developed upstream. Neither is acceptable for a contract the app depends on.

Instead, creating a Workspace scaffolds a `CLAUDE.md` into it. Claude Code auto-loads that file for any session started in the directory, so the contract applies with nothing to remember and nothing forked. It carries both directions of the integration: write Probes alongside each new lesson, and drain the Struggle queue at the start of each session.

The weakness is that this is instruction-following, not enforcement — a session can skip it. The app compensates by detecting lessons with no Probes and surfacing them, rather than by trying to make the contract binding.
