/** What every API route under `/api/ws` checks before it touches the disk. */

import { lessonName, workspaceName } from "./paths.ts";

/**
 * Both names arrive from a URL. Null rather than a throw, because every caller
 * answers a bad one the same way.
 */
export function names(ws: string, lesson: string): { ws: string; lesson: string } | null {
  try {
    return { ws: workspaceName(ws), lesson: lessonName(lesson) };
  } catch {
    return null;
  }
}

/**
 * The app is unauthenticated because it is yours and it is on localhost — which
 * also means any page open in the same browser can post to it. A cross-site
 * form post never sets this header to `same-origin`, so requiring it costs a
 * real request nothing and stops a stray tab spending your Claude subscription.
 */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  // A client too old to send it, or something that is not a browser at all.
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
}
