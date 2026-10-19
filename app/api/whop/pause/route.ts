import { NextRequest, NextResponse } from "next/server";
import { getActiveMembershipId, whopAuthHeaders } from "../whop-membership";

/** Length of the pause offered by Gate 2. Must match the gate's copy. */
const PAUSE_DAYS = 14;

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

    // Api-Version-Date is stripped on THIS request only, so Whop evaluates it
    // against whatever version the key itself is provisioned for.
    // whop-membership.ts still sets the header for every other caller.
    const pauseHeaders: Record<string, string> = { ...whopAuthHeaders() };
    delete pauseHeaders["Api-Version-Date"];

    // Retries are safe: Whop collapses repeats of the same key instead of
    // stacking a second pause onto the membership.
    pauseHeaders["Idempotency-Key"] = crypto.randomUUID();

    const res = await fetch(
      `https://api.whop.com/api/v1/memberships/${lookup.membershipId}/pause`,
      {
        method: "POST",
        headers: pauseHeaders,
        // Both field names, same timestamp. Older versions of the endpoint
        // take `until`, newer take `resumes_at`; sending both means whichever
        // the key's version expects lands and the other is ignored.
        body: JSON.stringify({
          until: resumesAtIso,
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
