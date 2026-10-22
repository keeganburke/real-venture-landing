import { NextRequest, NextResponse } from "next/server";
import { runDiscordSweep, SWEEP_CAP_MAX } from "../../../../lib/discord-kick";

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

  // Manual cap override (?cap=N, 1..SWEEP_CAP_MAX), read only after the Bearer
  // check above. The nightly cron never passes it, so it stays at SWEEP_CAP.
  const capParam = request.nextUrl.searchParams.get("cap");
  let cap: number | undefined;
  if (capParam !== null) {
    cap = /^\d+$/.test(capParam) ? Number(capParam) : NaN;
    if (!Number.isInteger(cap) || cap < 1 || cap > SWEEP_CAP_MAX) {
      return NextResponse.json({ ok: false, error: `cap must be an integer 1..${SWEEP_CAP_MAX}` }, { status: 400 });
    }
  }

  const summary = await runDiscordSweep({ cap });
  return NextResponse.json({ ok: true, ...summary });
}
