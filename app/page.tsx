import Link from "next/link";
import { listWorkspaces, summarise, type WorkspaceSummary } from "@/lib/workspace";
import NewWorkspace from "./NewWorkspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const names = await listWorkspaces();
  const workspaces = await Promise.all(names.map(summarise));
  const due = workspaces.reduce((n, w) => n + w.due, 0);

  return (
    <>
      <header className="masthead">
        <h1>Learn</h1>
        <p>{due > 0 ? `${due} due across ${workspaces.length} topics` : "nothing due"}</p>
      </header>

      {workspaces.length === 0 ? (
        <p className="empty">
          No topics yet. Make one below, then run <code>/teach</code> inside it — the lessons it
          writes turn up here as things to recall.
        </p>
      ) : (
        <div className="ledger">
          {workspaces.map((w) => <Entry key={w.name} w={w} />)}
        </div>
      )}

      <NewWorkspace />
    </>
  );
}

function Entry({ w }: { w: WorkspaceSummary }) {
  return (
    <Link className="entry" href={`/ws/${w.name}`}>
      <div>
        <h2 className="entry-name">{w.name}</h2>
        {w.started ? (
          <p className="entry-why">{w.why ?? "Mission written, no Why section yet."}</p>
        ) : (
          <p className="entry-why entry-idle">Waiting for /teach to write MISSION.md</p>
        )}
      </div>
      <div className="readout">
        <div>
          <span className="k">due</span>
          <span className={`v ${w.due ? "v-due" : "v-zero"}`}>{w.due}</span>
        </div>
        <div>
          <span className="k">probes</span>
          <span className="v v-zero">{w.total}</span>
        </div>
        <div>
          <span className="k">recall</span>
          <span className={`v ${w.retention !== null && w.retention < 0.9 ? "v-decay" : "v-zero"}`}>
            {w.retention === null ? "—" : `${Math.round(w.retention * 100)}%`}
          </span>
        </div>
      </div>
    </Link>
  );
}
