import { NextRequest, NextResponse } from "next/server";
import { runDiscordSweep } from "../../../../lib/discord-kick";

// Nightly Discord sweep (vercel.json: 09:00 UTC). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" on scheduled invocations; anything
// else is refused. Mode comes from DISCORD_KICK_MODE (unset = shadow).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/discord-sweep] CRON_SECRET unset, refusing");
    return NextResponse.json({ ok: false, error: "cron_secret_unset" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const summary = await runDiscordSweep();
  return NextResponse.json({ ok: true, ...summary });
}
