"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dict, type Locale } from "@/lib/i18n";

export default function NewWorkspace({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = dict[locale];
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? t.couldNotCreate);
      return;
    }
    setCreated(name);
    setName("");
    router.refresh();
  }

  if (created) {
    return (
      <section className="panel" style={{ marginTop: "2.5rem" }}>
        <h2>{t.topicCreated}</h2>
        <p>{t.topicCreatedBody}</p>
        <pre className="command">
          cd workspaces/{created}{"\n"}claude{"\n"}/teach
        </pre>
        <p className="note" style={{ marginTop: "0.9rem" }}>
          {t.showsUpBefore}
          <code>MISSION.md</code>
          {t.showsUpAfter}
        </p>
        <button className="quiet" style={{ marginTop: "1rem" }} onClick={() => setCreated(null)}>
          {t.addAnother}
        </button>
      </section>
    );
  }

  return (
    <form className="panel" style={{ marginTop: "2.5rem" }} onSubmit={create}>
      <h2>{t.newTopic}</h2>
      <div className="row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="rust"
          aria-label={t.topicName}
          pattern="[a-z0-9][a-z0-9-]*"
          required
        />
        <button disabled={busy || !name}>{busy ? t.creating : t.create}</button>
        <span className="note">{t.nameRules}</span>
      </div>
      {error && <p className="warn" style={{ marginTop: "0.8rem" }}>{error}</p>}
    </form>
  );
}
