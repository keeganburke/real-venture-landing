import { NextRequest, NextResponse } from "next/server";
import { runDiscordSweep, SWEEP_CAP_MAX, SWEEP_IDS_MAX } from "../../../../lib/discord-kick";

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

  // Manual batch size (?cap=N, 1..SWEEP_CAP_MAX), read only after the Bearer
  // check above: the first N candidates are acted on, the rest deferred. The
  // nightly cron never passes it, so it keeps the SWEEP_CAP abort rule.
  const capParam = request.nextUrl.searchParams.get("cap");
  let cap: number | undefined;
  if (capParam !== null) {
    cap = /^\d+$/.test(capParam) ? Number(capParam) : NaN;
    if (!Number.isInteger(cap) || cap < 1 || cap > SWEEP_CAP_MAX) {
      return NextResponse.json({ ok: false, error: `cap must be an integer 1..${SWEEP_CAP_MAX}` }, { status: 400 });
    }
  }

  // Manual exact-ID run (?ids=a,b,c), also read only after the Bearer check:
  // 1..SWEEP_IDS_MAX Discord ids, digits only. Only those members are
  // evaluated, each through the full decideKick; nobody is forced. Cannot be
  // combined with ?cap. The nightly cron never passes it.
  const idsParam = request.nextUrl.searchParams.get("ids");
  let ids: string[] | undefined;
  if (idsParam !== null) {
    if (capParam !== null) {
      return NextResponse.json({ ok: false, error: "ids and cap cannot be combined" }, { status: 400 });
    }
    const parts = idsParam.split(",");
    if (parts.length > SWEEP_IDS_MAX || parts.some((part) => !/^\d{5,25}$/.test(part))) {
      return NextResponse.json(
        { ok: false, error: `ids must be 1..${SWEEP_IDS_MAX} comma-separated Discord ids, digits only` },
        { status: 400 }
      );
    }
    ids = Array.from(new Set(parts));
  }

  const summary = await runDiscordSweep({ cap, ids });
  return NextResponse.json({ ok: true, ...summary });
}
