import Link from "next/link";
import type { Strings } from "@/lib/i18n";
import { getLocale, getStrings } from "@/lib/i18n.server";
import { listWorkspaces, summarise, type WorkspaceSummary } from "@/lib/workspace";
import NewWorkspace from "./NewWorkspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [t, locale] = await Promise.all([getStrings(), getLocale()]);
  const names = await listWorkspaces();
  const workspaces = await Promise.all(names.map(summarise));
  const due = workspaces.reduce((n, w) => n + w.due, 0);

  return (
    <>
      <header className="masthead">
        <h1>{t.title}</h1>
        <p>{due > 0 ? t.dueAcross(due, workspaces.length) : t.nothingDue}</p>
      </header>

      {workspaces.length === 0 ? (
        <p className="empty">
          {t.noTopicsBefore}
          <code>/teach</code>
          {t.noTopicsAfter}
        </p>
      ) : (
        <div className="ledger">
          {workspaces.map((w) => <Entry key={w.name} w={w} t={t} />)}
        </div>
      )}

      <NewWorkspace locale={locale} />
    </>
  );
}

function Entry({ w, t }: { w: WorkspaceSummary; t: Strings }) {
  return (
    <Link className="entry" href={`/ws/${w.name}`}>
      <div>
        <h2 className="entry-name">{w.name}</h2>
        {w.started ? (
          <p className="entry-why">{w.why ?? t.noWhyYet}</p>
        ) : (
          <p className="entry-why entry-idle">{t.waitingForMission}</p>
        )}
      </div>
      <div className="readout">
        <div>
          <span className="k">{t.kDue}</span>
          <span className={`v ${w.due ? "v-due" : "v-zero"}`}>{w.due}</span>
        </div>
        <div>
          <span className="k">{t.kProbes}</span>
          <span className="v v-zero">{w.total}</span>
        </div>
        <div>
          <span className="k">{t.kRecall}</span>
          <span className={`v ${w.retention !== null && w.retention < 0.9 ? "v-decay" : "v-zero"}`}>
            {w.retention === null ? "—" : `${Math.round(w.retention * 100)}%`}
          </span>
        </div>
      </div>
    </Link>
  );
}
