import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

const f = fsrs();

export type ReviewEvent = {
  t: string;
  probe: string;
  rating: 1 | 2 | 3 | 4;
  outcome: "correct" | "retrieval_failure" | "comprehension_failure";
  hints: number;
};

/**
 * Card state is a fold of the review log rather than something stored (ADR 0006).
 * ts-fsrs is stateless, so replaying is exact, and the log stays append-only.
 */
export function replay(events: ReviewEvent[], probeIds: string[]): Map<string, Card> {
  const cards = new Map<string, Card>();
  for (const id of probeIds) cards.set(id, createEmptyCard());

  for (const e of [...events].sort((a, b) => a.t.localeCompare(b.t))) {
    const card = cards.get(e.probe);
    if (!card) continue; // a Probe that no longer exists
    cards.set(e.probe, f.next(card, new Date(e.t), e.rating as Grade).card);
  }
  return cards;
}

export const isDue = (card: Card, now = new Date()) => card.due.getTime() <= now.getTime();

export function daysOverdue(card: Card, now = new Date()): number {
  return Math.max(0, (now.getTime() - card.due.getTime()) / 86_400_000);
}

/** Probability you'd recall this right now. Null for a Probe never yet seen. */
export function retrievability(card: Card, now = new Date()): number | null {
  if (card.state === State.New) return null;
  return f.get_retrievability(card, now, false);
}

export type Projection = { days: number; curve: number[]; learning: boolean };

/**
 * The signature strip: how recall decays from now until the Probe is next due.
 * Sampled straight off the same forgetting curve FSRS schedules against, so
 * what you see is the model's actual belief about your memory, not a metaphor.
 */
export function projection(card: Card, steps = 40): Projection {
  const days = Math.max(0, (card.due.getTime() - Date.now()) / 86_400_000);
  // Learning and relearning steps are fixed intervals, not retention targets,
  // so plotting a decay curve against them would state something untrue.
  const learning = card.state !== State.Review;
  const curve = learning
    ? []
    : Array.from({ length: steps + 1 }, (_, i) => f.forgetting_curve((days * i) / steps, card.stability));
  return { days, curve, learning };
}

export type Attempt = {
  hints: number;
  comprehension: boolean;
  completeness: "complete" | "partial";
};

/**
 * Verdict to FSRS grade (ADR 0004/0010). Claude never returns a rating — judging
 * the answer is teaching, mapping it onto an interval is scheduling.
 *
 * Rating.Easy is deliberately unreachable: FSRS inflates intervals badly when
 * Easy is applied liberally, and a Probe you had to be asked at all isn't easy.
 */
export function ratingFor(a: Attempt): Grade {
  if (a.comprehension) return Rating.Again;
  if (a.hints >= 2) return Rating.Again;
  if (a.hints === 1) return Rating.Hard;
  return a.completeness === "partial" ? Rating.Hard : Rating.Good;
}

/**
 * Reorder a session so consecutive Probes come from different lessons.
 * Interleaving is the one thing /teach asks for that a plain due-date queue
 * gets wrong: sorted by due date, a session tends to arrive in lesson order,
 * which is blocked practice.
 */
export function interleave<T extends { source: string }>(items: T[]): T[] {
  const pool = [...items];
  const out: T[] = [];
  let last = "";
  while (pool.length) {
    const group = (p: T) => p.source.split("#")[0];
    const i = pool.findIndex((p) => group(p) !== last);
    const [picked] = pool.splice(i === -1 ? 0 : i, 1);
    last = group(picked);
    out.push(picked);
  }
  return out;
}
