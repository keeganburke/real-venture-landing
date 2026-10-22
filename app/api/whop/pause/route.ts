import { NextRequest, NextResponse } from "next/server";
import { getActiveMembershipId } from "../whop-membership";
import { createAdminClient } from "../../../../lib/supabase/server";
import { manageAuthHeaders } from "../../../../lib/whop-manage";
import {
  fetchMembershipRow,
  membershipLooksPaused,
  membershipNextPaymentAt,
  PAUSE_SUCCEEDED_EVENT,
  readPauseState,
} from "../pause-state";

/** Length of the pause offered by Gate 2. Must match the gate's copy. */
const PAUSE_DAYS = 14;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The pause write uses WHOP_MANAGE_API_KEY via lib/whop-manage.ts (member:manage
// scope). The membership lookup that runs first keeps using WHOP_API_KEY.

// Pauses the caller's membership via Whop.
//
// POST /api/v1/memberships/{id}/pause — v1, confirmed against Whop's official
// API reference and against one live pause on 2026-10-22 (mem_LFgWJxU3PVzCrq).
//
// Order of operations, and why:
//   1. Resolve the membership (rv_session -> newest active/trialing).
//   2. Refuse WITHOUT touching Whop when the pause cannot or must not happen:
//        no_subscription  collection_method null / no current period (a comped
//                         or 100 % promo membership). Whop would answer 400
//                         "There is no subscription for this membership".
//        already_paused   Whop lists it under status=paused (or the row's
//                         most_recent_action is paused_at).
//        already_used     a pause_succeeded row for this Whop user in the last
//                         180 days (server-written only, see pause-state.ts).
//   3. POST the pause. resumes_at is a TIMESTAMP (now + 14 days);
//      void_payments: true forgives any past-due balance instead of carrying
//      it to the resume date. That write-off is intended.
//   4. Read the REAL outcome. Whop's 200 body is the Membership object, which
//      carries no resume date at all; "paused" shows only as
//      most_recent_action === "paused_at", and the next charge date is
//      current_period_end (unchanged by the pause). Both are read from the
//      response, or from a follow-up GET when the response lacks them.
//   5. Record pause_succeeded (server side) with resumes_at (the date we sent,
//      which Whop never echoes back; the UI and the resume cron read it from
//      this row) plus what Whop shows, then answer the client.
//
// Refusals answer HTTP 200 { ok: false, error: <code> } so the client can show
// a specific sentence; Whop failures keep the 502 + whop_status shape.
export async function POST(request: NextRequest) {
  try {
    const lookup = await getActiveMembershipId(request);
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });
    }
    const { membershipId, whopUserId } = lookup;

    // Optional body from CancelFlow: its analytics session id, so the
    // server-written pause_succeeded row joins the same funnel session.
    const body = (await request.json().catch(() => null)) as { session_id?: unknown; plan?: unknown } | null;
    const sessionId =
      typeof body?.session_id === "string" && UUID_RE.test(body.session_id)
        ? body.session_id
        : crypto.randomUUID();
    const plan = typeof body?.plan === "string" && body.plan.length <= 64 ? body.plan : null;

    const state = await readPauseState(whopUserId, lookup.membership);
    for (const w of state.warnings) console.warn("whop/pause: state read warning", w);
    if (state.block) {
      console.warn("whop/pause: refused", state.block, membershipId);
      if (state.block === "already_paused") {
        return NextResponse.json({ ok: false, error: "already_paused", resumes: state.resumesAt });
      }
      if (state.block === "already_used") {
        return NextResponse.json({ ok: false, error: "already_used", used_at: state.usedAt });
      }
      return NextResponse.json({ ok: false, error: "no_subscription" });
    }

    // 14 days from now, as an ISO 8601 date-time.
    const resumesAtIso = new Date(Date.now() + PAUSE_DAYS * 86_400_000).toISOString();

    const res = await fetch(`https://api.whop.com/api/v1/memberships/${membershipId}/pause`, {
      method: "POST",
      headers: {
        ...manageAuthHeaders(),
        // Retries are safe: Whop collapses repeats of the same key instead
        // of stacking a second pause onto the membership.
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        resumes_at: resumesAtIso,
        void_payments: true,
      }),
    });
    const rawText = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(rawText);
      data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const err = data?.error as { message?: unknown } | string | undefined;
      const message =
        (typeof err === "object" && err && typeof err.message === "string" && err.message) ||
        (typeof err === "string" && err) ||
        `whop pause failed (${res.status})`;
      // Full body, no secrets: Whop's error payload carries only type/message.
      console.error("whop/pause: whop error", res.status, membershipId, rawText.slice(0, 2000));
      // Whop's 400 for a comped / promo membership, in case the pre-check above
      // missed it (fields can lag right after checkout).
      if (res.status === 400 && /no subscription/i.test(message)) {
        return NextResponse.json({ ok: false, error: "no_subscription", whop_status: 400 });
      }
      // whop_status is surfaced so the client can treat 409 (already paused)
      // as its own case rather than a generic failure. HTTP 502 mirrors the
      // cancel route: this is an upstream failure, not a bad client request.
      return NextResponse.json(
        { ok: false, error: String(message), whop_status: res.status },
        { status: 502 }
      );
    }

    // Real outcome. The 200 body is the Membership object; fall back to a GET
    // when it does not carry the two fields we read.
    let outcome = data;
    let pausedConfirmed = outcome ? membershipLooksPaused(outcome) : false;
    let nextPaymentAt = outcome ? membershipNextPaymentAt(outcome) : null;
    if (!pausedConfirmed || nextPaymentAt === null) {
      const again = await fetchMembershipRow(membershipId);
      if (again.ok) {
        outcome = again.membership;
        pausedConfirmed = pausedConfirmed || membershipLooksPaused(outcome);
        nextPaymentAt = nextPaymentAt ?? membershipNextPaymentAt(outcome);
      } else {
        console.warn("whop/pause: follow-up GET failed", again.error);
      }
    }
    if (!pausedConfirmed) {
      console.warn("whop/pause: Whop answered", res.status, "but the membership does not read as paused", membershipId);
    }

    // Server-written success record. This row is what the 180-day reuse check
    // reads, so it must never depend on the client's fire-and-forget tracking.
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from("cancel_flow_events").insert({
        user_id: whopUserId,
        membership_id: membershipId,
        session_id: sessionId,
        plan,
        event_type: PAUSE_SUCCEEDED_EVENT,
        event_data: {
          pause_days: PAUSE_DAYS,
          resumes_at: resumesAtIso,
          next_payment_at: nextPaymentAt,
          paused_confirmed: pausedConfirmed,
          whop_status: res.status,
          whop_action: typeof outcome?.most_recent_action === "string" ? outcome.most_recent_action : null,
          whop_action_at: typeof outcome?.most_recent_action_at === "string" ? outcome.most_recent_action_at : null,
        },
      });
      if (error) console.error("whop/pause: pause_succeeded insert failed", error.message);
    } catch (err) {
      console.error("whop/pause: pause_succeeded insert threw", err);
    }

    return NextResponse.json({
      ok: true,
      // The date collection resumes: the resumes_at we sent (Whop accepted it
      // with a 2xx but never echoes it back). The success copy shows this.
      resumes_at: resumesAtIso,
      // What Whop shows as the next charge date (current_period_end), for
      // analytics; it does not move when a membership is paused.
      next_payment_at: nextPaymentAt,
      paused_confirmed: pausedConfirmed,
    });
  } catch (err) {
    console.error("whop/pause: error", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
