import { readFile, readdir } from "node:fs/promises";
import { inWorkspace } from "./paths";

export type Probe = {
  id: string;
  kind: "recall" | "walk";
  prompt: string;
  /** "lessons/0007-ownership.html#moves". Empty for walks, which carry their own source. */
  source: string;
  palace?: Palace;
};

export type Palace = {
  id: string;
  title: string;
  route: string;
  loci: { locus: string; image: string; encodes: string }[];
};

async function jsonFiles<T>(ws: string, dir: string): Promise<T[]> {
  let names: string[];
  try {
    names = await readdir(inWorkspace(ws, dir));
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
    try {
      out.push(JSON.parse(await readFile(inWorkspace(ws, `${dir}/${name}`), "utf8")) as T);
    } catch {
      // A malformed file Claude is mid-write on. Ignore it this pass.
    }
  }
  return out;
}

export async function loadPalaces(ws: string): Promise<Palace[]> {
  return (await jsonFiles<Palace>(ws, "palaces")).filter((p) => p?.id && Array.isArray(p.loci));
}

/**
 * Every Probe the workspace holds. A Palace contributes exactly one Walk, so
 * spatial review rides the same FSRS queue as everything else (ADR 0007).
 */
export async function loadProbes(ws: string): Promise<Probe[]> {
  const files = await jsonFiles<Probe[]>(ws, "probes");
  const recall: Probe[] = files
    .flat()
    .filter((p) => p?.id && p.prompt && p.source)
    .map((p) => ({ ...p, kind: "recall" as const }));

  const walks: Probe[] = (await loadPalaces(ws)).map((palace) => ({
    id: `palace:${palace.id}`,
    kind: "walk" as const,
    prompt: `Walk ${palace.route}, in order. At each locus, name what it encodes.`,
    source: "",
    palace,
  }));

  return [...recall, ...walks];
}

/** What Claude grades a Walk against, since a Palace has no lesson file. */
export function palaceText(p: Palace): string {
  const loci = p.loci.map((l, i) => `${i + 1}. ${l.locus} — ${l.image} — encodes: ${l.encodes}`);
  return `Palace "${p.title}" on the route ${p.route}. In order:\n${loci.join("\n")}`;
}

/** Routes are claimed by the Palaces that use them; no separate registry to drift (ADR 0008). */
export function claimedRoutes(palacesByWorkspace: Record<string, Palace[]>): Map<string, string> {
  const claims = new Map<string, string>();
  for (const [ws, palaces] of Object.entries(palacesByWorkspace)) {
    for (const p of palaces) if (p.route) claims.set(p.route.trim(), `${ws}/${p.id}`);
  }
  return claims;
}

