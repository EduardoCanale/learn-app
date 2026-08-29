# A failed Probe is not finished until you generate the answer yourself

The obvious behaviour on a wrong answer is to show the correct one, shorten the interval and move on. The evidence says that is the one thing that does not work: high-confidence errors return at a delay when feedback merely reveals the answer, and do *not* return when a test follows the correction. Separately, scaffolded feedback — hints that make the learner generate the answer — beats giving the answer outright on both 30-minute and 1-day delayed tests (Finn & Metcalfe 2010).

So a failed Probe must Close by self-generation, and the path there depends on the failure mode Claude diagnosed:

- **Retrieval failure**: a Scaffold. Escalating hints, retry between each, the answer only as a last resort. The understanding is intact, so a nudge should be enough to unlock it.
- **Comprehension failure**: hints cannot help a wrong model. Elaborated explanation plus the source section, then a rephrased re-Probe that must be answered correctly. The Struggle is queued for the next teaching session regardless, because a Repair is not a lesson.

This is the app's reason to exist. A static flashcard tool can shorten an interval; it cannot diagnose why you failed, nor scaffold you to your own answer.

Accepted cost: a failed Probe runs 2-4 Claude calls and takes minutes rather than seconds. Sessions are therefore short by design.
