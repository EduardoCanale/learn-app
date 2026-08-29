# Review units are free-recall Probes, not two-sided flashcards

The default design for a spaced-repetition app is a two-sided card: prompt, flip, self-grade. We rejected it on the evidence. Cued recall and recognition beat free recall on immediate performance but lose on delayed retention, because free recall forces relational processing — you reconstruct how ideas connect rather than fetching one association (Roediger & Payne 1983; Endres et al. on the relational processing hypothesis). Storage strength is the whole point of this app, so we optimise for the delayed test.

A Probe therefore has no back. It carries a prompt and an anchor to the source section that answers it. You type from memory and Claude grades against the source, returning elaborated feedback rather than a correct answer — retrieval practice with feedback runs to about g=0.50, and feedback explaining *why* an answer was wrong beats feedback that merely reveals the right one.

Consequences we accept: every review costs a `claude -p` call of a few seconds, reviews cannot happen offline, and typing is slower than clicking. That makes daily review sessions smaller than an Anki deck's — which is fine, because the Probes are denser.

Rejected: a tiered design where atomic facts self-grade offline and only conceptual items reach Claude. It halves the token cost but doubles the code paths, and the cheap tier is precisely the weaker instrument.
