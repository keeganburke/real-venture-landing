import { NextRequest, NextResponse } from "next/server";
import { chicago, recoveryMode, runPaymentRecovery, runRecoveryTest } from "../../../../lib/payment-recovery";
import { postWeeklySummary } from "../../../../lib/payment-recovery-stats";
import { captureDmReplies, type ReplyCaptureSummary } from "../../../../lib/payment-recovery-replies";
import { hourlyEmbed, postMorningDigest, resolveNames, type DigestResult } from "../../../../lib/payment-recovery-post";
import { postRecoveryEmbed } from "../../../../lib/discord-recovery-webhook";

// Hourly payment-recovery drip (vercel.json: "0 * * * *"). Same Bearer
// CRON_SECRET gate as discord-sweep and pause-resume. RECOVERY_MODE=live
// sends; anything else is shadow (no sends, no table writes, posts only).
// Discord posts (lib/payment-recovery-post.ts, webhook
// DISCORD_RECOVERY_WEBHOOK_URL falling back to DISCORD_MOD_WEBHOOK_URL):
//   - hourly embed, after the DM reply capture so a new reply counts, only
//     when a sequence closed (recovered or lost), a reply came in, or an
//     error happened. ?post=1 forces it on this run.
//   - morning digest, once per Chicago day on the first run at or after
//     9:00 (dedupe row in payment_recovery_posts, migration 033).
//   - each captured DM reply as its own embed, inside the capture.
// ?test_day=N (1 to 5) sends MESSAGE N's real copy to the owner only (env
// RECOVERY_TEST_PHONE / RECOVERY_TEST_EMAIL, owner Discord id) in any mode,
// touches no real member and writes no table. 400 if either env is missing.
// Weekly results post: the hourly run that lands on Monday 10:00 Chicago
// also posts the weekly summary (entered, recovered, rate vs baseline, $).
// ?weekly=1 forces that post on this run (any mode; it only reads).
// Discord DM replies (migration 032): after the sends, live mode only, the
// run polls the DM channels the drip has opened (up to 50 per run, least
// recently checked first) and posts every member reply as it is read.
// It stops early at REPLY_DEADLINE_MS after the request started so a heavy
// send hour never overruns; the rest wait for the next hour.
// maxDuration 300 (same as discord-sweep and pause-resume): at 60 the heavy
// 10:00 to 12:00 Chicago runs were killed about 60 s in (every
// payment_recovery_sends row written at :01:43 or :01:44 on 2026-11-01 and
// 11-02 was the last of its run, four of them left at status pending), which
// also skipped the end-of-run close-out that records paid sequences.
export const maxDuration = 300;
const REPLY_DEADLINE_MS = 240000;

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
  const startedAt = Date.now();
  const forcePost = request.nextUrl.searchParams.get("post") === "1";
  const summary = await runPaymentRecovery();
  const now = Date.now();
  let replies: ReplyCaptureSummary | null = null;
  if (recoveryMode() === "live") {
    try {
      replies = await captureDmReplies({ now, deadlineMs: startedAt + REPLY_DEADLINE_MS });
    } catch (err) {
      replies = { backfilled: 0, backfillErrors: 0, channelsChecked: 0, replies: 0, rateLimited: false, stoppedAtDeadline: false, errors: [`threw: ${err instanceof Error ? err.message : "unknown"}`] };
    }
  }
  // Hourly embed, then the morning digest. Both are formatting only; a
  // failure here never touches what was sent.
  let digest: DigestResult = { posted: false, reason: "not attempted" };
  try {
    const names = await resolveNames(summary);
    const embed = hourlyEmbed({ summary, names, now, replies: replies?.replies ?? 0, replyErrors: replies?.errors ?? [], force: forcePost });
    if (embed) summary.posted = await postRecoveryEmbed(embed);
    digest = await postMorningDigest(summary, names, now);
  } catch (err) {
    digest = { posted: false, reason: `posting threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
  const c = chicago(now);
  const weeklyDue = request.nextUrl.searchParams.get("weekly") === "1" || (c.weekday === 1 && c.hour === 10);
  let weekly: { posted: boolean; text: string } | null = null;
  if (weeklyDue) {
    try {
      weekly = await postWeeklySummary(now);
    } catch (err) {
      weekly = { posted: false, text: `weekly summary threw: ${err instanceof Error ? err.message : "unknown"}` };
    }
  }
  return NextResponse.json({ ok: true, ...summary, digest, weekly, replies });
}
