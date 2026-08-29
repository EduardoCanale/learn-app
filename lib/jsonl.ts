import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Append-only event logs (ADR 0011). Both this app and Claude append to these
 * files and neither ever rewrites one, so two writers need no lock. O_APPEND
 * keeps a single short line atomic on a local filesystem.
 */
export async function append(file: string, event: object): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(event) + "\n", "utf8");
}

export async function read<T>(file: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // A half-written last line means Claude is appending right now. Skip it;
      // it will parse on the next read.
    }
  }
  return out;
}
