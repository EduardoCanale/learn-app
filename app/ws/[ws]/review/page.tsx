import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getStrings } from "@/lib/i18n.server";
import { read } from "@/lib/jsonl";
import { reviewsLog, workspaceName } from "@/lib/paths";
import { loadProbes } from "@/lib/probes";
import { interleave, isDue, replay, type ReviewEvent } from "@/lib/scheduler";
import ReviewSession from "./ReviewSession";

export const dynamic = "force-dynamic";

/** A failed Probe runs several Claude calls and takes minutes, so sessions stay short. */
const SESSION_SIZE = 10;

export default async function Review({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: raw } = await params;
  const [t, locale] = await Promise.all([getStrings(), getLocale()]);
  let ws: string;
  try {
    ws = workspaceName(raw);
  } catch {
    notFound();
  }

  const probes = await loadProbes(ws);
  const cards = replay(await read<ReviewEvent>(reviewsLog(ws)), probes.map((p) => p.id));
  const now = new Date();

  const due = probes
    .filter((p) => isDue(cards.get(p.id)!, now))
    .sort((a, b) => cards.get(a.id)!.due.getTime() - cards.get(b.id)!.due.getTime());

  const session = interleave(due).slice(0, SESSION_SIZE);

  return (
    <>
      <header className="masthead">
        <h1>{ws}</h1>
        <Link className="back" href={`/ws/${ws}`}>{t.leave}</Link>
      </header>

      {session.length === 0 ? (
        <p className="empty">{t.nothingDueFaded}</p>
      ) : (
        <ReviewSession
          ws={ws}
          locale={locale}
          remaining={due.length}
          probes={session.map((p) => ({ id: p.id, kind: p.kind, prompt: p.prompt }))}
        />
      )}
    </>
  );
}
