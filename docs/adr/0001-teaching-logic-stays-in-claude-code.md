# Teaching logic stays in Claude Code; the app owns scheduling and the palace

The obvious build for a learning app is to put the pedagogy in the app. We are doing the opposite. `/teach` already encodes the methodology — mission-grounding, zone of proximal development, fluency vs storage strength — and it runs in Claude Code where the conversation is already good. Rebuilding that as a web chat UI would mean reimplementing session resume, streaming, tool rendering and permissions to arrive somewhere worse.

So: authoring lessons, reference docs, learning records and glossary terms is Claude's, in the terminal, unchanged. The app owns the two things `/teach` structurally cannot do — deciding what resurfaces when, and the spatial memory layer. The app is not a file viewer; it holds real logic. Just never pedagogy.
