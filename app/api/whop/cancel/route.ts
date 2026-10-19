import { NextRequest, NextResponse } from "next/server";
import { getActiveMembershipId, whopAuthHeaders } from "../whop-membership";

// Cancels the caller's membership via Whop.
//
// POST /api/v1/memberships/{id}/cancel — v1, confirmed against Whop's official
// API reference. This was v2, written by analogy to the pause route ("mirroring
// the pause route") and never verified; a wrong path returns 404, which the
// member saw as "Something went wrong".
//
// cancellation_mode "at_period_end" is sent EXPLICITLY rather than relying on
// the default: the member keeps the access they already paid for and simply
// does not renew. The default must never be allowed to silently become
// immediate termination.
//
// The Api-Version-Date header rides on whopAuthHeaders().
export async function POST(request: NextRequest) {
  try {
    const lookup = await getActiveMembershipId(request);
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });
    }

    const res = await fetch(
      `https://api.whop.com/api/v1/memberships/${lookup.membershipId}/cancel`,
      {
        method: "POST",
        headers: whopAuthHeaders(),
        body: JSON.stringify({ cancellation_mode: "at_period_end" }),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data?.error?.message ?? data?.error ?? `whop cancel failed (${res.status})`;
      console.error("whop/cancel: whop error", res.status, message);
      return NextResponse.json({ ok: false, error: String(message) }, { status: 502 });
    }

    const endsAt = data?.renewal_period_end ?? data?.expires_at ?? null;
    return NextResponse.json({ ok: true, ends_at: endsAt });
  } catch (err) {
    console.error("whop/cancel: error", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
