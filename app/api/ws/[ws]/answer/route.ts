import { NextResponse } from "next/server";
import { ClaudeUnavailable, grade, type Turn } from "@/lib/claude";
import { getStrings } from "@/lib/i18n.server";
import { append, read } from "@/lib/jsonl";
import { inWorkspace, reviewsLog, strugglesLog, workspaceName } from "@/lib/paths";
import { loadProbes, palaceText } from "@/lib/probes";
import { projection, ratingFor, replay, type ReviewEvent } from "@/lib/scheduler";
import { loadSource } from "@/lib/source";
import { openStruggles } from "@/lib/workspace";

export async function POST(request: Request, { params }: { params: Promise<{ ws: string }> }) {
  const { ws: raw } = await params;
  const t = await getStrings();
  let ws: string;
  try {
    ws = workspaceName(raw);
  } catch {
    return NextResponse.json({ error: t.unknownTopic }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const probeId: unknown = body?.probe;
  const turns: unknown = body?.turns;
  if (typeof probeId !== "string" || !Array.isArray(turns) || turns.length === 0) {
    return NextResponse.json({ error: t.badRequest }, { status: 400 });
  }
  const history = turns as Turn[];

  const probe = (await loadProbes(ws)).find((p) => p.id === probeId);
  if (!probe) return NextResponse.json({ error: t.unknownProbe }, { status: 404 });

  // The app inlines the source; the Claude call gets no tools (ADR 0010).
  const [rel, anchor] = probe.source.split("#");
  const source = probe.palace
    ? { text: palaceText(probe.palace), html: "" }
    : await loadSource(inWorkspace(ws, rel), anchor ?? null);

  let verdict;
  try {
    verdict = await grade(source.text, probe.prompt, history);
  } catch (err) {
    if (err instanceof ClaudeUnavailable) {
      // No degraded mode: grading is the review (ADR 0010).
      return NextResponse.json({ error: err.message, unavailable: true }, { status: 503 });
    }
    throw err;
  }

  const hints = history.filter((t) => t.hint).length;
  const comprehension = history.some((t) => t.reprobe) || verdict.outcome === "comprehension_failure";

  if (verdict.outcome === "comprehension_failure") {
    const alreadyOpen = (await openStruggles(ws)).some((s) => s.probe === probe.id);
    if (!alreadyOpen) {
      await append(strugglesLog(ws), {
        t: new Date().toISOString(),
        event: "opened",
        probe: probe.id,
        gap: verdict.gap || probe.prompt.slice(0, 60),
      });
    }
    return NextResponse.json({ verdict, sourceHtml: source.html });
  }

  if (verdict.outcome === "retrieval_failure") {
    return NextResponse.json({ verdict });
  }

  // Closed by self-generation (ADR 0009). Record the review and reschedule.
  const now = new Date();
  const rating = ratingFor({ hints, comprehension, completeness: verdict.completeness });
  await append(reviewsLog(ws), {
    t: now.toISOString(),
    probe: probe.id,
    rating,
    outcome: "correct",
    hints,
  } satisfies ReviewEvent);

  // A Struggle closes only once it has been taught, so a same-session recovery
  // never removes it before Claude has seen it.
  const struggle = (await openStruggles(ws)).find((s) => s.probe === probe.id);
  if (struggle?.taught) {
    await append(strugglesLog(ws), { t: now.toISOString(), event: "closed", probe: probe.id });
  }

  const ids = (await loadProbes(ws)).map((p) => p.id);
  const card = replay(await read<ReviewEvent>(reviewsLog(ws)), ids).get(probe.id)!;

  return NextResponse.json({ verdict, scheduled: projection(card) });
}
