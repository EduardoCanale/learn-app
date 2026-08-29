# FSRS for scheduling, not a hand-rolled SM-2

Scheduling is the app's own logic, so there is a real temptation to write it — SM-2 is about forty lines. We are using an existing FSRS implementation instead. FSRS-6 is fit against a public benchmark of roughly 700 million real reviews; it predicts recall better than SM-2 in 99.6% of collections and holds a 90% retention target to ±5.3% where SM-2 deviates ±16.2%, needing an estimated 20-30% fewer reviews for the same retention.

Forty lines we understand are not worth a scheduler that is measurably worse at the app's single most important job. This is the one place where a dependency beats writing it ourselves.

Note that FSRS expects a four-point grade (again/hard/good/easy). Our Verdicts come from Claude, not a button, so the app must map a Verdict onto that scale — that mapping is ours to own and tune.
