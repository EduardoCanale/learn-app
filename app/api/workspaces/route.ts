import { NextResponse } from "next/server";
import { getStrings } from "@/lib/i18n.server";
import { workspaceName } from "@/lib/paths";
import { create } from "@/lib/workspace";

export async function POST(request: Request) {
  const t = await getStrings();
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: t.nameRequired }, { status: 400 });

  let ws: string;
  try {
    ws = workspaceName(name);
  } catch {
    return NextResponse.json({ error: t.badName }, { status: 400 });
  }

  try {
    await create(ws);
  } catch (err) {
    // Only the collision is the caller's fault; anything else is a real failure.
    if ((err as Error).message === "exists") {
      return NextResponse.json({ error: t.alreadyExists(ws) }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ name: ws });
}
