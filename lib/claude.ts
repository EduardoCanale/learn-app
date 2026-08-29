import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

/** Thrown when Claude can't be reached. Review blocks rather than degrading (ADR 0010). */
export class ClaudeUnavailable extends Error {}

const TIMEOUT_MS = 120_000;

const BASE_ARGS = [
  "-p",
  "--model", "sonnet",
  // Strips CLAUDE.md, plugins, hooks, skills and output styles, so the user's
  // own configuration can't reshape a grading response. Keeps OAuth, unlike --bare.
  "--safe-mode",
  "--strict-mcp-config",
  "--tools", "", // zero tools: the app inlines the source itself (ADR 0010)
  "--no-session-persistence",
  "--output-format", "json",
];

async function ask<T>(system: string, prompt: string, schema: object): Promise<T> {
  const args = [...BASE_ARGS, "--json-schema", JSON.stringify(schema), "--system-prompt", system];

  const stdout = await new Promise<string>((resolve, reject) => {
    // Run outside any workspace so no project memory is discovered.
    const child = spawn("claude", args, { cwd: tmpdir() });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ClaudeUnavailable(`No response after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new ClaudeUnavailable(`Could not start claude: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new ClaudeUnavailable(err.trim() || `claude exited ${code}`));
    });

    child.stdin.end(prompt);
  });

  let events: unknown;
  try {
    events = JSON.parse(stdout);
  } catch {
    throw new ClaudeUnavailable("Response was not JSON");
  }
  const result = (Array.isArray(events) ? events : [events]).find(
    (e): e is { type: string; is_error?: boolean; structured_output?: T } =>
      typeof e === "object" && e !== null && (e as { type?: string }).type === "result",
  );
  if (!result || result.is_error) throw new ClaudeUnavailable("Claude reported an error");
  if (!result.structured_output) throw new ClaudeUnavailable("No structured output returned");
  return result.structured_output;
}

const GRADER = `You grade free-recall answers for a spaced-repetition system. It is built on two
findings: retrieval practice with elaborated feedback beats being shown the answer, and a
correction only holds if the learner generates the answer themselves.

You receive the SOURCE that answers the question, the PROMPT, and the learner's attempts
so far with any hints already given.

Choose one outcome.

correct — the answer captures what the source says. Mark it complete, or partial if it is
right but thin.

retrieval_failure — the model is sound, they just did not produce it. Signs: the right
shape with a name or step missing, hedging, near-misses on terminology.

comprehension_failure — the model itself is wrong. Signs: a confident claim contradicting
the source, two concepts conflated, a reversed causal direction.

That distinction is the whole point. A hint cannot repair a wrong model, and an
explanation is wasted on someone who only needed a nudge.

Then fill the fields:

correct — feedback names what they got and anything the source adds. hint, reprobe and
gap stay empty.

retrieval_failure — hint points at what is missing without containing it. Escalate: each
hint gives a little more than the last, and only a third hint may state the answer. gap
and reprobe stay empty; feedback stays empty until they close it.

comprehension_failure — feedback explains, in two to four sentences drawn from the source,
why the answer is wrong and what is actually true. reprobe asks the same underlying thing
in different words so they must generate it. gap names the confusion in under eight words.

Never put the answer inside a hint. Never praise. Write plainly, second person, no preamble.`;

const SCHEMA = {
  type: "object",
  properties: {
    outcome: { type: "string", enum: ["correct", "retrieval_failure", "comprehension_failure"] },
    completeness: { type: "string", enum: ["complete", "partial"] },
    feedback: { type: "string" },
    hint: { type: "string" },
    reprobe: { type: "string" },
    gap: { type: "string" },
  },
  required: ["outcome", "completeness", "feedback", "hint", "reprobe", "gap"],
  additionalProperties: false,
} as const;

export type Verdict = {
  outcome: "correct" | "retrieval_failure" | "comprehension_failure";
  completeness: "complete" | "partial";
  feedback: string;
  hint: string;
  reprobe: string;
  gap: string;
};

export type Turn = { answer: string; hint?: string; reprobe?: string };

export function gradePrompt(source: string, prompt: string, turns: Turn[]): string {
  const history = turns.flatMap((t, i) => [
    `ATTEMPT ${i + 1}`,
    t.answer.trim() || "(left blank)",
    ...(t.hint ? [`HINT GIVEN AFTER ATTEMPT ${i + 1}`, t.hint] : []),
    ...(t.reprobe ? [`REPHRASED QUESTION ASKED AFTER ATTEMPT ${i + 1}`, t.reprobe] : []),
  ]);
  return ["SOURCE", source, "", "PROMPT", prompt, "", ...history].join("\n");
}

export function grade(source: string, prompt: string, turns: Turn[]): Promise<Verdict> {
  return ask<Verdict>(GRADER, gradePrompt(source, prompt, turns), SCHEMA);
}
