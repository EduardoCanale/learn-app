/**
 * Ask: a real, streaming Claude session, scoped to a Passage the learner is
 * looking at and given read-only run of the Workspace (ADR 0015). Deliberately
 * not `lib/claude.ts` — that file is the grading envelope, it is one-shot with
 * zero tools, and none of that changes here.
 */

import { getSessionMessages, query } from "@anthropic-ai/claude-agent-sdk";
import { append, read } from "./jsonl.ts";
import { inWorkspace, wsDir } from "./paths.ts";

/** Read-only, and the whole list: `tools` is what exists, `allowedTools` is what runs unasked. */
const TOOLS = ["Read", "Glob", "Grep"];

const ASK = `A learner is reading a lesson in this workspace and has selected a passage. You
answer questions about that passage. Nothing else.

You can read the workspace you are in, and you should. MISSION.md says why they are
learning this at all. NOTES.md is what the teacher decided about how to teach them.
notes/ is their own writing about these lessons. .learn/struggles.jsonl is what they
have already got wrong. Read what you need to answer well and skip the rest.

Answer the question and stop. Ground the answer in the passage and in the lesson
around it, connect it to the mission when that is what makes it land, and say plainly
when the lesson is the wrong place to look.

You are not teaching the course. Do not write lessons, probes, palaces or records, do
not write to any file, and do not decide what they learn next — the workspace's own
CLAUDE.md asks for those and it is not addressed to you. Do not quiz them back.

Answer in the language the lesson is written in. Write plainly, second person, no
preamble and no praise. Prose and blank lines only — no headings, no bullets, no
bold: the answer is read in a panel that shows Markdown as the characters you typed.`;

export type AskChunk = { type: "text"; text: string } | { type: "error"; text: string };

export type AskTurn = { quote: string; question: string; answer: string };

type AskEvent = { t: string; lesson: string; session: string };

const sessionsLog = (ws: string) => inWorkspace(ws, ".learn/ask-sessions.jsonl");

/**
 * The prompt's two halves, written and read back in one place: the transcript
 * is the only record of the thread, so this is also how it is un-formatted for
 * display.
 */
export function askPrompt(quote: string, question: string): string {
  return `PASSAGE\n${quote}\n\nQUESTION\n${question}`;
}

export function askParts(prompt: string): { quote: string; question: string } {
  const parts = /^PASSAGE\n([\s\S]*?)\n\nQUESTION\n([\s\S]*)$/.exec(prompt);
  return parts ? { quote: parts[1], question: parts[2] } : { quote: "", question: prompt };
}

/** Append-only and folded last-wins, like every other log in `.learn/` (ADR 0011). */
async function sessionFor(ws: string, lesson: string): Promise<string | undefined> {
  let found: string | undefined;
  for (const event of await read<AskEvent>(sessionsLog(ws))) {
    if (event.lesson === lesson) found = event.session;
  }
  return found;
}

/** The thread so far, read back out of the session's own transcript. */
export async function thread(ws: string, lesson: string): Promise<AskTurn[]> {
  const session = await sessionFor(ws, lesson);
  if (!session) return [];

  const turns: AskTurn[] = [];
  for (const message of await getSessionMessages(session, { dir: wsDir(ws) })) {
    const text = textOf(message.message);
    if (!text) continue; // a tool call or its result, which is not part of the thread
    if (message.type === "user") turns.push({ ...askParts(text), answer: "" });
    else if (message.type === "assistant" && turns.length) turns[turns.length - 1].answer += text;
  }
  return turns.filter((turn) => turn.question);
}

export async function* ask(
  ws: string,
  lesson: string,
  quote: string,
  question: string,
): AsyncGenerator<AskChunk> {
  try {
    const resume = await sessionFor(ws, lesson);

    for await (const message of query({
      prompt: askPrompt(quote, question),
      options: {
        cwd: wsDir(ws),
        resume,
        systemPrompt: ASK,
        // `tools` is the boundary; `allowedTools` only stops it asking. The app
        // owns every write to a Note, so this session has no way to make one.
        tools: TOOLS,
        allowedTools: TOOLS,
        permissionMode: "dontAsk",
        // `cwd` only says where the session starts. Without this, `Read` takes
        // any absolute path the dev server can open, and the question it is
        // answering came off a rendered page — so the Workspace is made the
        // boundary here rather than in the wording of the system prompt.
        settings: { permissions: { blockReadsOutsideWorkingDirectories: true } },
        // Isolation: without this the Workspace's own CLAUDE.md loads, and that
        // file is a contract telling Claude to write probes and palaces.
        settingSources: [],
        skills: [],
        includePartialMessages: true,
        maxTurns: 8,
      },
    })) {
      if (message.type === "system" && message.subtype === "init" && message.session_id !== resume) {
        await append(sessionsLog(ws), {
          t: new Date().toISOString(),
          lesson,
          session: message.session_id,
        } satisfies AskEvent);
      }

      if (message.type === "stream_event") {
        const event = message.event;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }

      if (message.type === "result" && message.subtype !== "success") {
        yield { type: "error", text: message.subtype };
        return;
      }
    }
  } catch (err) {
    // No degraded mode and no silence: the reader says so and offers a retry.
    // The detail stays here — it carries absolute paths, and the lesson frame
    // can read what this streams.
    console.error("ask failed", err);
    yield { type: "error", text: "unavailable" };
  }
}

/** A transcript message is API-shaped but typed `unknown`, so narrow it by hand. */
function textOf(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  let out = "";
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const { type, text } = block as { type?: unknown; text?: unknown };
    if (type === "text" && typeof text === "string") out += text;
  }
  return out;
}
