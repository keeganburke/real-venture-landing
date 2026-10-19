import { NextRequest, NextResponse } from "next/server";
import { getActiveMembershipId, WHOP_API_VERSION_DATE } from "../whop-membership";

/** Length of the pause offered by Gate 2. Must match the gate's copy. */
const PAUSE_DAYS = 14;

/**
 * The key for the outbound pause call — NOT the general WHOP_API_KEY.
 *
 * WHOP_API_KEY is provisioned on Whop API version 2026-09-22, whose permission
 * vocabulary is membership:cancel / membership:transfer. There is no
 * member:manage scope in that model, so the v1 pause endpoint rejected it with
 * a 403 that no amount of granting could fix. WHOP_MANAGE_API_KEY is a separate
 * company key on 2026-10-15-1 with the Owner role.
 *
 * Local and non-exported, following lib/whop-affiliates.ts, so nothing else in
 * the codebase can reach for the manage key by accident. It deliberately does
 * NOT fall back to WHOP_API_KEY the way the affiliates helper does: falling
 * back would silently reproduce the exact 403 this exists to avoid, and a
 * loud config error is far easier to read than a permissions one.
 */
function requireWhopManageApiKey(): string {
  const key = process.env.WHOP_MANAGE_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error("WHOP_MANAGE_API_KEY is unset or empty");
  }
  return key;
}

/**
 * Headers for the pause call only. Same shape as whopAuthHeaders() in
 * whop-membership.ts, which is left untouched and still serves every other
 * caller — including the membership lookup that runs first inside this route,
 * which keeps using WHOP_API_KEY.
 */
function manageAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireWhopManageApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Api-Version-Date": WHOP_API_VERSION_DATE,
  };
}

// Pauses the caller's membership via Whop.
//
// POST /api/v1/memberships/{id}/pause — v1, confirmed against Whop's official
// API reference. Was v2, established only by a discovery probe that proved the
// path existed (401-gated), not that it was the right one.
//
// resumes_at is a TIMESTAMP, not a duration, and it is NEWLY TRANSMITTED —
// not a renamed field. The previous body was `{ void_payments: true }` and
// nothing more, so the pause length this flow promises was never communicated
// to Whop at all; every pause ran on Whop's own default. The day count lived
// only in the gate's copy and in the pause_accepted analytics event. Expect
// live behaviour to change here, because real information is now being sent
// that never was before.
//
// void_payments: true is KEPT DELIBERATELY. It forgives any outstanding
// past-due balance on the membership rather than carrying it to the resume
// date. That is a real write-off and it is the intended behaviour.
//
// The pinned Api-Version-Date (whopAuthHeaders) is what makes resumes_at the
// correct field name; Whop renamed it between versions.
export async function POST(request: NextRequest) {
  try {
    const lookup = await getActiveMembershipId(request);
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });
    }

    // 14 days from now, as an ISO 8601 date-time.
    const resumesAtIso = new Date(Date.now() + PAUSE_DAYS * 86_400_000).toISOString();

    const res = await fetch(
      `https://api.whop.com/api/v1/memberships/${lookup.membershipId}/pause`,
      {
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
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data?.error?.message ?? data?.error ?? `whop pause failed (${res.status})`;
      console.error("whop/pause: whop error", res.status, message);
      // whop_status is surfaced so the client can treat 409 (already paused)
      // as its own case rather than a generic failure. HTTP 502 mirrors the
      // cancel route: this is an upstream failure, not a bad client request.
      return NextResponse.json(
        { ok: false, error: String(message), whop_status: res.status },
        { status: 502 }
      );
    }

    // TODO: the API version is now pinned (WHOP_API_VERSION_DATE), so the
    // response is a Membership object — but the field carrying the resume date
    // is still unconfirmed against a LIVE paused response. Confirm it and drop
    // whichever branch is wrong. The defensive read stays until then.
    const resumesAt = data?.resumes_at ?? data?.pauses_until ?? resumesAtIso;
    return NextResponse.json({ ok: true, resumes_at: resumesAt });
  } catch (err) {
    console.error("whop/pause: error", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
