import { readFile } from "node:fs/promises";
import path from "node:path";
import { inWorkspace } from "@/lib/paths";

// Lessons are self-contained HTML that /teach wrote to be read on their own, so
// they are served raw into a new tab rather than reframed by this app.
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

export async function GET(_request: Request, { params }: { params: Promise<{ ws: string; path: string[] }> }) {
  const { ws, path: parts } = await params;
  const rel = parts.map(decodeURIComponent).join("/");
  const type = TYPES[path.extname(rel).toLowerCase()];
  if (!type) return new Response("Not served", { status: 415 });

  try {
    const file = await readFile(inWorkspace(ws, rel));
    return new Response(new Uint8Array(file), { headers: { "content-type": type } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
