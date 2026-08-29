import Link from "next/link";
import { notFound } from "next/navigation";
import { getStrings } from "@/lib/i18n.server";
import { loadPalaces } from "@/lib/probes";
import { listLessons, openStruggles, summarise, syncPlaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Workspace({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const t = await getStrings();

  let summary, palaces, lessons, struggles;
  try {
    // Route claims are global, so they are recomputed and written into this
    // workspace's PLACES.md whenever you look at it.
    await syncPlaces(ws);
    [summary, palaces, lessons, struggles] = await Promise.all([
      summarise(ws),
      loadPalaces(ws),
      listLessons(ws),
      openStruggles(ws),
    ]);
  } catch {
    notFound();
  }

  return (
    <>
      <header className="masthead">
        <h1>{summary.name}</h1>
        <Link className="back" href="/">{t.allTopics}</Link>
      </header>

      {!summary.started ? (
        <section className="panel">
          <h2>{t.notStarted}</h2>
          <p>{t.notStartedBody}</p>
          <pre className="command">cd workspaces/{summary.name}{"\n"}claude{"\n"}/teach</pre>
        </section>
      ) : (
        <p className="entry-why" style={{ maxWidth: "52ch", marginBottom: "2rem" }}>{summary.why}</p>
      )}

      <section className="panel">
        <h2>{t.review}</h2>
        {summary.total === 0 ? (
          <p className="note">{t.noProbesYet}</p>
        ) : summary.due === 0 ? (
          <p className="note">{t.holding(summary.total, summary.retention)}</p>
        ) : (
          <div className="row">
            <Link href={`/ws/${summary.name}/review`}>
              <button>{t.recallProbes(summary.due)}</button>
            </Link>
            <span className="note">{t.typedFromMemory}</span>
          </div>
        )}
      </section>

      {struggles.length > 0 && (
        <section className="panel">
          <h2>{t.waitingToBeTaught}</h2>
          <p className="note" style={{ marginBottom: "0.9rem" }}>
            {t.waitingToBeTaughtNote}
          </p>
          <ul className="plain">
            {struggles.map((s) => (
              <li key={s.probe}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", color: "var(--ink-faint)" }}>
                  {s.probe}
                </span>{" "}
                {s.gap}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.unprobed.length > 0 && (
        <section className="panel">
          <h2>{t.unprobedLessons}</h2>
          <p className="warn">{t.unprobedNote}</p>
          <ul className="plain">
            {summary.unprobed.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>
      )}

      {palaces.length > 0 && (
        <section className="panel">
          <h2>{t.palaces}</h2>
          {palaces.map((p) => (
            <details key={p.id} style={{ marginBottom: "0.6rem" }}>
              <summary>
                {p.title} <span className="note">{t.routeLoci(p.route, p.loci.length)}</span>
              </summary>
              <ol className="loci">
                {p.loci.map((l, i) => (
                  <li key={i}>
                    <div>
                      <div className="locus">{l.locus}</div>
                      <div className="image">{l.image}</div>
                      <div className="encodes">{l.encodes}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </section>
      )}

      {lessons.length > 0 && (
        <section className="panel">
          <h2>{t.lessons}</h2>
          <ul className="plain">
            {lessons.map((l) => (
              <li key={l}>
                <a href={`/ws/${summary.name}/lesson/lessons/${encodeURIComponent(l)}`} target="_blank" rel="noreferrer">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
