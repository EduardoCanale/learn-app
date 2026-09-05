import { NextResponse } from "next/server";
import { ask, thread } from "@/lib/ask";
import { getStrings } from "@/lib/i18n.server";
import { names, sameOrigin } from "@/lib/route";

type Params = { params: Promise<{ ws: string }> };

/** A question about one passage. Anything longer is not that. */
const MAX = 8_000;

export async function GET(request: Request, { params }: Params) {
  const t = await getStrings();
  const named = names((await params).ws, new URL(request.url).searchParams.get("lesson") ?? "");
  if (!named) return NextResponse.json({ error: t.unknownTopic }, { status: 404 });

  return NextResponse.json({ turns: await thread(named.ws, named.lesson) });
}

/**
 * NDJSON rather than SSE: this is a POST, so `EventSource` is out, and the
 * client reads it with `body.getReader()`.
 */
export async function POST(request: Request, { params }: Params) {
  const t = await getStrings();
  const { ws } = await params;

  // This spawns a Claude Code subprocess on the user's own subscription, so it
  // is not something another tab gets to set off.
  if (!sameOrigin(request)) return NextResponse.json({ error: t.badRequest }, { status: 403 });

  const body = await request.json().catch(() => null);
  const question: unknown = body?.question;
  const quote: unknown = body?.quote;

  const named = names(ws, typeof body?.lesson === "string" ? body.lesson : "");
  if (!named) return NextResponse.json({ error: t.unknownTopic }, { status: 404 });
  if (typeof question !== "string" || typeof quote !== "string") {
    return NextResponse.json({ error: t.badRequest }, { status: 400 });
  }
  if (!question.trim() || question.length > MAX || quote.length > MAX) {
    return NextResponse.json({ error: t.badRequest }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // `ask` reports its own failures as a final chunk, so nothing here can
      // leave the reader waiting on a stream that has stopped.
      for await (const chunk of ask(named.ws, named.lesson, quote, question)) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
