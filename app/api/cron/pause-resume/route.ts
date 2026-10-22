import { NextRequest, NextResponse } from "next/server";
import { runPauseResume } from "../../../../lib/pause-resume";

// Daily pause safety net (vercel.json: 09:30 UTC). Same Bearer CRON_SECRET
// gate as discord-sweep. Resumes memberships whose recorded 14-day pause
// ended more than 24 h ago and that Whop still lists as paused; never touches
// memberships without a pause_succeeded event. PAUSE_RESUME_MODE=live to act,
// anything else is shadow (log + mod post).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const summary = await runPauseResume();
  return NextResponse.json({ ok: true, ...summary });
}
