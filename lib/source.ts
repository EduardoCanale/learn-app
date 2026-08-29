import { readFile } from "node:fs/promises";

export type Source = { html: string; text: string; file: string; anchor: string | null };

const MAX = 12_000;

/**
 * A Probe points at "lessons/0007-ownership.html#moves". Pull out that section
 * only: from the tag carrying the id to the next heading at the same or a
 * higher level. Claude is sent the text, the review screen renders the html.
 *
 * ponytail: regex over html this project's own lessons produce. If lessons ever
 * come from somewhere we don't control, swap in a real parser.
 */
export async function loadSource(file: string, anchor: string | null): Promise<Source> {
  const html = await readFile(file, "utf8");
  const section = anchor ? sliceSection(html, anchor) : bodyOf(html);
  return { html: section, text: toText(section), file, anchor };
}

export function sliceSection(html: string, anchor: string): string {
  const idAt = html.search(new RegExp(`id=["']${escapeRe(anchor)}["']`, "i"));
  if (idAt === -1) return bodyOf(html);

  const start = html.lastIndexOf("<", idAt);
  const opening = html.slice(start, idAt + 200);
  // If the anchor sits on a heading, the section ends at the next heading of
  // equal or greater importance. Otherwise assume an h3-level block.
  const level = Number(/^<h([1-6])/i.exec(opening)?.[1] ?? 3);
  const after = html.slice(start + 1);
  const next = after.search(new RegExp(`<h[1-${level}][\\s>]`, "i"));
  const end = next === -1 ? html.length : start + 1 + next;
  return html.slice(start, Math.min(end, start + MAX));
}

function bodyOf(html: string): string {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return (body ? body[1] : html).slice(0, MAX);
}

export function toText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
