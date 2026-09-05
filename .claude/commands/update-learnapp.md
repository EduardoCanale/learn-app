---
description: Bring this installation of the learn app forward — pull, install, test, build, and report what changed
allowed-tools: Bash(git status:*), Bash(git pull:*), Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(npm install:*), Bash(npm test:*), Bash(npm run build:*), Read, Glob
---

Bring this checkout of the learn app up to date. Work in the repository root.

Do these in order and stop at the first one that fails.

**1. Refuse on a dirty tree.** Run `git status --porcelain`. If anything comes
back, stop and list exactly what is dirty. Do not stash and do not commit — the
uncommitted work is the user's and they may want it. Tell them to commit or
stash it themselves and run this again.

**2. Record where we are.** `git rev-parse HEAD`. You need it in step 5.

**3. Pull.** `git pull`. If it conflicts, stop, say which files conflict, and
leave the merge in place for the user to resolve. Do not resolve it for them.

**4. Install and check.** `npm install`, then `npm test`, then `npm run build`.
If any of them fails, stop and show the actual output — not a summary of it.

**5. Say what changed** since the revision from step 2:

- New or amended ADRs (`git diff --name-status <old>..HEAD -- docs/adr/`), each
  with its one-line title.
- Whether `templates/CLAUDE.md` changed, and if so what the change asks of
  `/teach`.
- New or changed dependencies (`git diff <old>..HEAD -- package.json`).

**6. Say plainly what was not touched.** `workspaces/` and `PLACES.md` are
gitignored — they are the user's own data and nothing here writes to them. Each
workspace's `CLAUDE.md` refreshes itself from the template the next time its
page is opened in the app, so there is nothing to run for that either.

Then stop. Do not offer to change anything.
