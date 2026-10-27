import { NextRequest, NextResponse } from "next/server";
import { runPaymentRecovery, runRecoveryTest } from "../../../../lib/payment-recovery";

// Hourly payment-recovery drip (vercel.json: "0 * * * *"). Same Bearer
// CRON_SECRET gate as discord-sweep and pause-resume. RECOVERY_MODE=live
// sends; anything else is shadow (no sends, no table writes, summary only).
// ?post=1 forces the mod-channel summary on this run.
// ?test_day=N (1 to 5) sends day N's real copy to the owner only (env
// RECOVERY_TEST_PHONE / RECOVERY_TEST_EMAIL, owner Discord id) in any mode,
// touches no real member and writes no table. 400 if either env is missing.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const testDay = request.nextUrl.searchParams.get("test_day");
  if (testDay !== null) {
    const result = await runRecoveryTest(Number(testDay));
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  const forcePost = request.nextUrl.searchParams.get("post") === "1";
  const summary = await runPaymentRecovery({ forcePost });
  return NextResponse.json({ ok: true, ...summary });
}
