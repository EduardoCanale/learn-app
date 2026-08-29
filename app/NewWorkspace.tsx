"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewWorkspace() {
  const router = useRouter();
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
      setError((await res.json().catch(() => ({}))).error ?? "Could not create it.");
      return;
    }
    setCreated(name);
    setName("");
    router.refresh();
  }

  if (created) {
    return (
      <section className="panel" style={{ marginTop: "2.5rem" }}>
        <h2>Topic created</h2>
        <p>
          The folders, the teaching contract and your places are in place. The mission is
          Claude&apos;s to draw out of you, so start it there:
        </p>
        <pre className="command">
          cd workspaces/{created}{"\n"}claude{"\n"}/teach
        </pre>
        <p className="note" style={{ marginTop: "0.9rem" }}>
          It shows up as started once <code>MISSION.md</code> exists.
        </p>
        <button className="quiet" style={{ marginTop: "1rem" }} onClick={() => setCreated(null)}>
          Add another
        </button>
      </section>
    );
  }

  return (
    <form className="panel" style={{ marginTop: "2.5rem" }} onSubmit={create}>
      <h2>New topic</h2>
      <div className="row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="rust"
          aria-label="Topic name"
          pattern="[a-z0-9][a-z0-9-]*"
          required
        />
        <button disabled={busy || !name}>{busy ? "Creating…" : "Create"}</button>
        <span className="note">Lowercase, no spaces. One mission per topic.</span>
      </div>
      {error && <p className="warn" style={{ marginTop: "0.8rem" }}>{error}</p>}
    </form>
  );
}
