import path from "node:path";

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const ROOT = process.cwd();
export const WORKSPACES = path.join(ROOT, "workspaces");
export const PLACES_FILE = path.join(ROOT, "PLACES.md");

/** Workspace names arrive from URLs. Anything that isn't a plain slug is rejected. */
export function workspaceName(raw: string): string {
  if (!SLUG.test(raw)) throw new Error(`Not a workspace name: ${raw}`);
  return raw;
}

/** Lesson basenames arrive from URLs too, and they name a file we open. */
export function lessonName(raw: string): string {
  if (!SLUG.test(raw)) throw new Error(`Not a lesson name: ${raw}`);
  return raw;
}

export function wsDir(raw: string): string {
  return path.join(WORKSPACES, workspaceName(raw));
}

/** Resolve a workspace-relative path, refusing anything that climbs out of it. */
export function inWorkspace(ws: string, rel: string): string {
  const base = wsDir(ws);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error(`Path escapes workspace: ${rel}`);
  }
  return full;
}

export const learnDir = (ws: string) => inWorkspace(ws, ".learn");
export const reviewsLog = (ws: string) => inWorkspace(ws, ".learn/reviews.jsonl");
export const strugglesLog = (ws: string) => inWorkspace(ws, ".learn/struggles.jsonl");
