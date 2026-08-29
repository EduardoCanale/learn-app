import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPalaces } from "@/lib/probes";
import { listLessons, openStruggles, summarise, syncPlaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Workspace({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;

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
        <Link className="back" href="/">All topics</Link>
      </header>

      {!summary.started ? (
        <section className="panel">
          <h2>Not started</h2>
          <p>Claude draws the mission out of you before anything else. Start it in a terminal:</p>
          <pre className="command">cd workspaces/{summary.name}{"\n"}claude{"\n"}/teach</pre>
        </section>
      ) : (
        <p className="entry-why" style={{ maxWidth: "52ch", marginBottom: "2rem" }}>{summary.why}</p>
      )}

      <section className="panel">
        <h2>Review</h2>
        {summary.total === 0 ? (
          <p className="note">
            No probes yet. They arrive with your first lesson — Claude writes them alongside it.
          </p>
        ) : summary.due === 0 ? (
          <p className="note">
            Nothing due. {summary.total} probes are holding
            {summary.retention !== null && ` at ${Math.round(summary.retention * 100)}% recall`}.
          </p>
        ) : (
          <div className="row">
            <Link href={`/ws/${summary.name}/review`}>
              <button>Recall {summary.due} {summary.due === 1 ? "probe" : "probes"}</button>
            </Link>
            <span className="note">Typed from memory, graded against the lesson.</span>
          </div>
        )}
      </section>

      {struggles.length > 0 && (
        <section className="panel">
          <h2>Waiting to be taught</h2>
          <p className="note" style={{ marginBottom: "0.9rem" }}>
            Answers that showed the model was wrong, not just unretrieved. Claude reads these at
            the start of your next session and teaches them before anything new.
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
          <h2>Lessons with no probes</h2>
          <p className="warn">
            These were taught but never turned into recall, so they are not being reviewed. Ask
            Claude to write probes for them.
          </p>
          <ul className="plain">
            {summary.unprobed.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>
      )}

      {palaces.length > 0 && (
        <section className="panel">
          <h2>Palaces</h2>
          {palaces.map((p) => (
            <details key={p.id} style={{ marginBottom: "0.6rem" }}>
              <summary>
                {p.title} <span className="note">— {p.route}, {p.loci.length} loci</span>
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
          <h2>Lessons</h2>
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
