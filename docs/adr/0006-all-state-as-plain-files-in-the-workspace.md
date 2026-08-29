# All learning state is plain files inside the Workspace

Claude Code confines file access to its working directory, and Claude runs inside a Workspace. So anything Claude must read has to live there. That alone rules out a central store for Probes and Struggles.

We went further and put *everything* there — FSRS card state and the full review history included — as JSON and JSONL under `.learn/`. The reason is not simplicity, though it is simpler. It is that a plain-text review history is readable by Claude when planning the next lesson. "What have I been failing for three weeks?" becomes a file read, and the answer steers the teaching. A SQLite file at the app root would be cleaner to write and would have severed exactly the signal that makes this better than a flashcard app.

Scale makes this safe: hundreds of Probes, not millions. `ts-fsrs` is a stateless scheduler, so nothing in the algorithm wants a database.

Accepted cost: both the app and Claude write to these files, so appends must be atomic and the app must tolerate a file Claude has rewritten underneath it.
