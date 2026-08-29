"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { dict, type Locale, type Strings } from "@/lib/i18n";

type Probe = { id: string; kind: "recall" | "walk"; prompt: string };
type Turn = { answer: string; hint?: string; reprobe?: string };
type Verdict = {
  outcome: "correct" | "retrieval_failure" | "comprehension_failure";
  completeness: "complete" | "partial";
  feedback: string;
  hint: string;
  reprobe: string;
  gap: string;
};
type Scheduled = { days: number; curve: number[]; learning: boolean };

export default function ReviewSession({
  ws,
  locale,
  probes,
  remaining,
}: {
  ws: string;
  locale: Locale;
  probes: Probe[];
  remaining: number;
}) {
  const t = dict[locale];
  const [index, setIndex] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [sourceHtml, setSourceHtml] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<Scheduled | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const probe = probes[index];
  const closed = verdict?.outcome === "correct";
  const asked = turns.at(-1)?.reprobe || probe?.prompt;

  if (!probe) {
    return (
      <>
        <p className="empty">
          {t.sessionDone}{" "}
          {remaining > probes.length ? t.stillDue(remaining - probes.length) : t.allCleared}
        </p>
        <div className="row" style={{ marginTop: "1.5rem" }}>
          <Link href={`/ws/${ws}`}><button className="quiet">{t.backTo(ws)}</button></Link>
        </div>
      </>
    );
  }

  async function submit() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError(null);

    const attempt: Turn[] = [...turns, { answer }];
    const res = await fetch(`/api/ws/${ws}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ probe: probe.id, turns: attempt }),
    }).catch(() => null);
    setBusy(false);

    if (!res || !res.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(
        body?.unavailable ? t.claudeUnreachable(body.error) : (body?.error ?? t.gradingFailed),
      );
      return;
    }

    const data = (await res.json()) as { verdict: Verdict; sourceHtml?: string; scheduled?: Scheduled };
    setVerdict(data.verdict);

    if (data.verdict.outcome === "correct") {
      setTurns(attempt);
      setScheduled(data.scheduled ?? null);
      return;
    }

    // Not closed yet: record what was given back, clear the box, ask again.
    const back: Turn =
      data.verdict.outcome === "retrieval_failure"
        ? { answer, hint: data.verdict.hint }
        : { answer, reprobe: data.verdict.reprobe };
    setTurns([...turns, back]);
    setSourceHtml(data.sourceHtml ?? null);
    setAnswer("");
    requestAnimationFrame(() => box.current?.focus());
  }

  function next() {
    setIndex(index + 1);
    setTurns([]);
    setAnswer("");
    setVerdict(null);
    setSourceHtml(null);
    setScheduled(null);
    setError(null);
  }

  return (
    <>
      <div className="progress">
        <span>{t.progress(index + 1, probes.length)}</span>
        <span>{t.dueCount(remaining)}</span>
      </div>

      <h2 className="probe">
        {probe.kind === "walk" && <span className="probe-kind">{t.walk}</span>}
        {turns.at(-1)?.reprobe && <span className="probe-kind">{t.askedAgain}</span>}
        {asked}
      </h2>

      {turns.at(-1)?.reprobe && (
        <p className="asked-first">
          <b>{t.originallyAsked}</b> {probe.prompt}
        </p>
      )}

      {turns.length > 0 && (
        <ol className="ladder">
          {turns.map((turn, i) => (
            <li key={i} className={turn.hint ? "hint" : undefined}>
              <span className="rung">{t.youSaid}</span>
              <p className="said" style={{ margin: "0 0 0.7rem" }}>{turn.answer}</p>
              {turn.hint && (
                <>
                  <span className="rung rung-hint">{t.hintN(i + 1)}</span>
                  <p style={{ margin: 0 }}>{turn.hint}</p>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {verdict && verdict.outcome !== "retrieval_failure" && verdict.feedback && (
        <section className={`verdict${closed ? " ok" : ""}`}>
          <h3>
            {closed
              ? verdict.completeness === "partial" ? t.rightButThin : t.right
              : t.notWhatLessonSays}
          </h3>
          <p>{verdict.feedback}</p>

          {sourceHtml && (
            /* Local lesson HTML that Claude wrote in your own workspace. */
            <div className="source" dangerouslySetInnerHTML={{ __html: sourceHtml }} />
          )}

          {scheduled && <DecayStrip {...scheduled} t={t} />}
        </section>
      )}

      {error && <p className="warn" style={{ marginTop: "1.5rem" }}>{error}</p>}

      {closed ? (
        <div className="actions">
          <button onClick={next} autoFocus>
            {index + 1 < probes.length ? t.nextProbe : t.finish}
          </button>
        </div>
      ) : (
        <>
          <textarea
            ref={box}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder={t.answerPlaceholder}
            aria-label={t.yourAnswer}
            disabled={busy}
          />
          <div className="actions">
            <button onClick={submit} disabled={busy || !answer.trim()}>
              {busy ? t.checking : t.check}
            </button>
            <span className="hint-key">⌘↵</span>
          </div>
        </>
      )}
    </>
  );
}

/**
 * The signature: the forgetting curve FSRS is actually scheduling against, from
 * now until this Probe comes back. Plotted over 80-100% rather than 0-100%,
 * because that is the band the whole system lives in — FSRS picks the day the
 * curve crosses its 90% target, and the dashed line is that target. You are
 * looking at the model's belief about your memory, not a metaphor for it.
 */
const FLOOR = 0.8;
const TARGET = 0.9;

function DecayStrip({ days, curve, learning, t }: Scheduled & { t: Strings }) {
  if (learning) {
    return (
      <figure className="decay" style={{ margin: 0 }}>
        <figcaption>
          {t.backInBefore}<b>{formatDays(days, t)}</b>{t.backInAfter}
          <br />
          {t.learningSteps}
        </figcaption>
      </figure>
    );
  }

  const W = 220;
  const H = 52;
  const x = (i: number) => 1 + (i / (curve.length - 1)) * (W - 2);
  const y = (r: number) => 2 + (1 - (Math.min(1, Math.max(FLOOR, r)) - FLOOR) / (1 - FLOOR)) * (H - 4);
  const line = curve.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(r).toFixed(1)}`).join(" ");
  const end = curve[curve.length - 1] ?? 0;

  return (
    <figure className="decay" style={{ margin: 0 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden>
        <line x1="0" y1={y(TARGET)} x2={W} y2={y(TARGET)} stroke="var(--rule)" strokeDasharray="2 3" />
        <path d={`${line} L${x(curve.length - 1).toFixed(1)} ${H} L1 ${H} Z`} fill="var(--decay)" opacity="0.1" />
        <path d={line} fill="none" stroke="var(--decay)" strokeWidth="1.5" />
        <circle cx={x(curve.length - 1)} cy={y(end)} r="2.5" fill="var(--decay)" />
      </svg>
      <figcaption>
        {t.fallingToBefore}<b>{formatDays(days, t)}</b>{t.fallingToAfter}
        <br />
        {t.asksAgainThatDay}
      </figcaption>
    </figure>
  );
}

function formatDays(days: number, t: Strings): string {
  if (days < 1) return t.hours(Math.max(1, Math.round(days * 24)));
  if (days < 60) return t.days(Math.round(days));
  return t.months(Math.round(days / 30));
}
