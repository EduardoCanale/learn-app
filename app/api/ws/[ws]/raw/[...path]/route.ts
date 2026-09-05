import { readFile } from "node:fs/promises";
import path from "node:path";
import { inWorkspace } from "@/lib/paths";

// Lessons are self-contained HTML that /teach wrote to be read on their own, so
// they are served exactly as written and wrapped in a same-origin iframe rather
// than reframed into React, which would kill their scripts (ADR 0014). Relative
// links inside a Lesson resolve back onto this same route.
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};

/**
 * A Lesson runs its own scripts (ADR 0014) and the reader frames it same-origin
 * so it can reach the selection, which together mean lesson HTML can drive the
 * app's own routes. It cannot send anything anywhere: no lesson does network IO
 * — they are documents — so connections and form posts are refused outright,
 * while the scripts, styles and web fonts they do use keep working.
 */
const POLICY = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "media-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export async function GET(_request: Request, { params }: { params: Promise<{ ws: string; path: string[] }> }) {
  const { ws, path: parts } = await params;
  const rel = parts.map(decodeURIComponent).join("/");
  const type = TYPES[path.extname(rel).toLowerCase()];
  if (!type) return new Response("Not served", { status: 415 });

  try {
    const file = await readFile(inWorkspace(ws, rel));
    return new Response(new Uint8Array(file), {
      headers: { "content-type": type, "content-security-policy": POLICY },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
