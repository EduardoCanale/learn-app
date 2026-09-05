import { mkdir, readFile, readdir, rename, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { PLACES_FILE, ROOT, WORKSPACES, inWorkspace, lessonName, reviewsLog, strugglesLog, workspaceName, wsDir } from "./paths";
import { read } from "./jsonl";
import { emptyNote, parseNote, serialiseNote, type Note } from "./notes";
import { claimedRoutes, loadPalaces, loadProbes, type Palace } from "./probes";
import { isDue, replay, retrievability, type ReviewEvent } from "./scheduler";

export type StruggleEvent = {
  t: string;
  event: "opened" | "taught" | "closed";
  probe: string;
  gap?: string;
};

export type WorkspaceSummary = {
  name: string;
  /** A Workspace is only started once /teach has written MISSION.md. */
  started: boolean;
  why: string | null;
  total: number;
  due: number;
  overdue: number;
  /** Mean chance you'd recall a seen Probe right now. Null before anything is reviewed. */
  retention: number | null;
  struggles: number;
  /** Lessons Claude wrote without Probes — the contract's known soft spot (ADR 0005). */
  unprobed: string[];
};

const exists = (p: string) => access(p).then(() => true, () => false);

export async function listWorkspaces(): Promise<string[]> {
  try {
    const entries = await readdir(WORKSPACES, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .filter((n) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(n))
      .sort();
  } catch {
    return [];
  }
}

/** The "Why" paragraph of MISSION.md, which grounds everything /teach produces. */
async function missionWhy(ws: string): Promise<string | null> {
  try {
    const md = await readFile(inWorkspace(ws, "MISSION.md"), "utf8");
    const why = /##\s*Why\s*\n+([\s\S]*?)(?=\n##|$)/i.exec(md)?.[1];
    return why?.trim().split("\n").join(" ") || null;
  } catch {
    return null;
  }
}

export type OpenStruggle = { probe: string; gap: string; taught: boolean };

/**
 * Fold the append-only log into the Struggles still open. `taught` matters:
 * a Struggle only closes once the Probe is answered correctly *after* Claude
 * has taught it, so a same-session recovery never erases the queue entry
 * before the teaching session ever sees it (ADR 0011).
 */
export async function openStruggles(ws: string): Promise<OpenStruggle[]> {
  const open = new Map<string, OpenStruggle>();
  for (const e of await read<StruggleEvent>(strugglesLog(ws))) {
    if (e.event === "opened") open.set(e.probe, { probe: e.probe, gap: e.gap ?? "", taught: false });
    if (e.event === "taught") {
      const s = open.get(e.probe);
      if (s) s.taught = true;
    }
    if (e.event === "closed") open.delete(e.probe);
  }
  return [...open.values()];
}

async function unprobedLessons(ws: string): Promise<string[]> {
  let lessons: string[];
  try {
    lessons = (await readdir(inWorkspace(ws, "lessons"))).filter((n) => n.endsWith(".html"));
  } catch {
    return [];
  }
  const missing: string[] = [];
  for (const lesson of lessons.sort()) {
    const id = /^(\d+)/.exec(lesson)?.[1];
    if (!id) continue;
    if (!(await exists(inWorkspace(ws, `probes/${id}.json`)))) missing.push(lesson);
  }
  return missing;
}

export async function summarise(name: string): Promise<WorkspaceSummary> {
  const ws = workspaceName(name);
  const [why, probes, reviews, struggles, unprobed] = await Promise.all([
    missionWhy(ws),
    loadProbes(ws),
    read<ReviewEvent>(reviewsLog(ws)),
    openStruggles(ws),
    unprobedLessons(ws),
  ]);

  const now = new Date();
  const cards = replay(reviews, probes.map((p) => p.id));
  const seen = [...cards.values()].map((c) => retrievability(c, now)).filter((r): r is number => r !== null);

  return {
    name: ws,
    started: why !== null || (await exists(inWorkspace(ws, "MISSION.md"))),
    why,
    total: probes.length,
    due: [...cards.values()].filter((c) => isDue(c, now)).length,
    overdue: seen.filter((r) => r < 0.9).length,
    retention: seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : null,
    struggles: struggles.length,
    unprobed,
  };
}

export async function create(name: string): Promise<void> {
  const ws = workspaceName(name);
  const dir = wsDir(ws);
  // A sentinel, not a message: the wording belongs to the route, which knows
  // the caller's language.
  if (await exists(dir)) throw new Error("exists");

  for (const sub of ["lessons", "reference", "learning-records", "assets", "probes", "palaces", "notes", ".learn"]) {
    await mkdir(path.join(dir, sub), { recursive: true });
  }
  const template = await readFile(path.join(ROOT, "templates", "CLAUDE.md"), "utf8");
  await writeFile(path.join(dir, "CLAUDE.md"), template, "utf8");
  await syncPlaces(ws);
}

/**
 * Routes are a finite resource and claims are global, so the app resolves them
 * and writes the answer into each Workspace's copy of PLACES.md (ADR 0008).
 * Claims are derived from the Palaces that use them — there is no registry to
 * drift out of sync.
 */
export async function syncPlaces(ws: string): Promise<void> {
  let places: string;
  try {
    places = await readFile(PLACES_FILE, "utf8");
  } catch {
    return;
  }

  const byWorkspace: Record<string, Palace[]> = {};
  for (const other of await listWorkspaces()) byWorkspace[other] = await loadPalaces(other);
  const claims = claimedRoutes(byWorkspace);

  const annotated = places.replace(/^##[ \t]+(.+)$/gm, (_, heading: string) => {
    const route = heading.replace(/\s+—\s+(CLAIMED.*|free)$/, "").trim();
    const claim = claims.get(route);
    return `## ${route} — ${claim ? `CLAIMED by ${claim}` : "free"}`;
  });
  await writeFile(inWorkspace(ws, "PLACES.md"), annotated, "utf8");
}

export async function listLessons(ws: string): Promise<string[]> {
  try {
    return (await readdir(inWorkspace(ws, "lessons"))).filter((n) => n.endsWith(".html")).sort();
  } catch {
    return [];
  }
}

/* --- Notes (ADR 0013). The format itself is in lib/notes.ts. ------------- */

export function notePath(ws: string, lesson: string): string {
  return inWorkspace(ws, `notes/${lessonName(lesson)}.md`);
}

/** A Workspace with no `notes/` has no Notes yet, which is not an error. */
export async function loadNote(ws: string, lesson: string): Promise<Note> {
  try {
    return parseNote(await readFile(notePath(ws, lesson), "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyNote();
    throw err;
  }
}

/**
 * Written beside the target and renamed over it, so a crash mid-write cannot
 * leave someone with half a Note. `notes/` is created on the first write —
 * Workspaces made before this feature existed never had one.
 */
export async function saveNote(ws: string, lesson: string, note: Note): Promise<void> {
  const file = notePath(ws, lesson);
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, serialiseNote(note), "utf8");
  await rename(temp, file);
}

export type NoteSummary = { lesson: string; count: number };

export async function listNotes(ws: string): Promise<NoteSummary[]> {
  let files: string[];
  try {
    files = (await readdir(inWorkspace(ws, "notes"))).filter((n) => n.endsWith(".md"));
  } catch {
    return [];
  }

  const out: NoteSummary[] = [];
  for (const file of files.sort()) {
    try {
      const md = await readFile(inWorkspace(ws, `notes/${file}`), "utf8");
      out.push({ lesson: file.slice(0, -3), count: parseNote(md).annotations.length });
    } catch {
      // A half-written temp file or something that is not ours. Skip it.
    }
  }
  return out;
}
