---
status: accepted — amends ADR 0005
---

# The Workspace contract is rewritten from the template on every Workspace-page view

ADR 0005 puts the app's contract with Claude in a `CLAUDE.md` scaffolded into each Workspace at creation. Scaffolding once means the contract is frozen at whatever the template said that day, so every later change — Notes being the first — reaches new Workspaces only. That is not a theoretical drift: it would have left the feature dead in all three Workspaces that exist.

So `CLAUDE.md` is regenerated from `templates/CLAUDE.md` whenever a Workspace page is viewed, beside the `syncPlaces` call that already rewrites `PLACES.md` there for exactly this reason. The cost is that the Workspace's `CLAUDE.md` becomes explicitly app-owned and hand edits to it are overwritten — which is what ADR 0005 already claims it is; the place to change the contract is the template. Rejected a one-off migration script: it fixes today's drift and recreates the problem on the next contract change. The write is skipped when the content is unchanged, so viewing a page does not churn mtimes, and it is a deterministic whole-file write rather than an append — it does not touch the append-only discipline ADR 0011 requires of the `.learn/` logs.
