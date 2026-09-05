# Learn App

A local web app that sits on top of the `/teach` skill. It does not teach — Claude Code does that in the terminal. The app owns everything `/teach` cannot do on its own: scheduling what you revisit and when, and the spatial memory layer.

## Language

**Workspace**:
A directory under `workspaces/` holding the `/teach` artifacts for exactly one mission — `MISSION.md`, `lessons/`, `reference/`, `learning-records/`, `assets/`.
_Avoid_: Project, course, folder

**Topic**:
The subject a Workspace teaches. One Topic per Workspace, because one mission per Workspace.
_Avoid_: Subject, deck

**Retrieval failure**:
A lapse where the understanding is intact but recall did not fire. Answered by scheduling alone — shorter interval, no new material.
_Avoid_: Forgot, missed, failed

**Comprehension failure**:
A lapse where the underlying model is wrong or absent, not merely unretrieved. Answered by a Repair, and by queueing the gap for the next teaching session.
_Avoid_: Didn't understand, confusion

**Repair**:
A short, in-the-moment correction Claude produces during review when a lapse is diagnosed as a Comprehension failure. Bounded to the moment — a full remedial lesson is not a Repair.
_Avoid_: Explanation, hint, feedback

**Probe**:
One free-recall question plus an anchor to the source section that answers it. Deliberately has no back — it is answered by generating from memory, not by flipping.
_Avoid_: Card, flashcard, question, item

**Verdict**:
Claude's judgement of a free-recall answer against the Probe's source: how complete the answer was, and whether any gap is a Retrieval failure or a Comprehension failure.
_Avoid_: Grade, score, mark

**Struggle**:
A logged Comprehension failure waiting to be taught properly. Written by the app during review, drained by Claude at the start of the next teaching session.
_Avoid_: Gap, weakness, todo, issue

**Palace**:
An ordered set of Loci drawn from a place you know well, each holding a vivid image that encodes one member of an enumerable set. Built only for material that is genuinely enumerable — a sequence, a taxonomy, a fixed set of rules.
_Avoid_: Memory palace, mind palace, method of loci

**Locus**:
One position on a Palace's route, holding exactly one image. Positions are fixed and ordered; the order is part of what is recalled.
_Avoid_: Station, peg, spot, node

**Walk**:
Reviewing a Palace by traversing its Loci in order and naming what each encodes. Graded on completeness and on sequence, since order is the thing loci practice actually trains.
_Avoid_: Palace review, tour

**Route**:
One real place you know well, written down once as an ordered list of Loci. A Route is claimed by at most one Palace, ever — reusing a Route across Palaces causes old images to bleed into new ones at the same Locus.
_Avoid_: Place, journey, path

**Scaffold**:
The escalating sequence of hints Claude gives after a Retrieval failure, each revealing less than the answer. The point is that you generate the answer yourself; handing it over ends the Scaffold in failure, not success.
_Avoid_: Hint, clue, help

**Close**:
Ending a failed Probe by producing a correct answer yourself, after a Scaffold or a Repair. A Probe that was merely explained is not Closed, because the error was never overwritten by a correct retrieval.
_Avoid_: Complete, finish, pass

**Note**:
The student's own writing about one Lesson, kept as a single file that only the student's actions change. Distinct from the Working notes `/teach` keeps about how to teach them.
_Avoid_: Notes file, annotations file, journal

**Working notes**:
`NOTES.md` — Claude's scratchpad about the learner: their preferences, the teaching decisions taken, the questions still open. Owned by `/teach`, never by the student.
_Avoid_: Notes

**Annotation**:
One entry in a Note: a Passage, and either what the student wrote about it or an Ask answer they chose to keep.
_Avoid_: Comment, highlight, entry, mark

**Passage**:
The span of a Lesson an Annotation or an Ask is about. Always a contiguous run of text the student selected.
_Avoid_: Selection, range, excerpt

**Anchor**:
How a Passage is found again in its Lesson: the quoted text with the words either side of it, plus a character position. The quote is what makes it survive the Lesson being rewritten; the position is only a hint that makes the search cheap.
_Avoid_: Reference, pointer, location, offset

**Ask**:
A question the student puts to Claude about a Passage, answered in a thread that lasts as long as the Lesson. Bounded to the passage in front of them — an Ask cannot author a Lesson, a Probe or a Palace.
_Avoid_: Chat, conversation, query
