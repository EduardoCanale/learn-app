# Next.js run locally, with no database, no auth and no deployment

An app that never leaves localhost, serves one user, and stores everything in flat files has no need for most of Next.js. We picked it anyway because it is already the user's idiom — two existing projects are Next + React + Tailwind + TypeScript — and "boring" is measured against the person maintaining it, not against a framework's feature list. Route handlers are the API; they spawn `claude -p`, fold the `.learn/` logs, and serve `/teach`'s lesson HTML. One process, one command.

React earns its place on the review screen specifically: a Probe moves through answering, grading, Verdict, an escalating Scaffold, and Close, and that is real state rather than a form post.

Explicitly excluded: no database (ADR 0006), no auth, no ORM, no deploy target. `ts-fsrs` is the only non-obvious dependency (ADR 0004).

Rejected: a single Bun file with a vanilla frontend, which is the smaller build but hand-rolls the state machine and the styling; and Vite plus Hono, which is lighter than Next but runs two processes and a proxy to avoid features we would not have used anyway.
