import { NextRequest, NextResponse } from "next/server";
import { getActiveMembershipId, whopAuthHeaders } from "../whop-membership";

// Pauses the caller's membership via Whop. Path confirmed by discovery probe:
// POST /api/v2/memberships/{id}/pause exists (401-gated for unauthenticated calls).
export async function POST(request: NextRequest) {
  try {
    const lookup = await getActiveMembershipId(request);
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });
    }

    const res = await fetch(
      `https://api.whop.com/api/v2/memberships/${lookup.membershipId}/pause`,
      {
        method: "POST",
        headers: whopAuthHeaders(),
        body: JSON.stringify({ void_payments: true }),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data?.error?.message ?? data?.error ?? `whop pause failed (${res.status})`;
      console.error("whop/pause: whop error", message);
      return NextResponse.json({ ok: false, error: String(message) });
    }

    // TODO: confirm the real field name on a live paused membership response.
    const resumesAt = data?.resumes_at ?? data?.pauses_until ?? undefined;
    return NextResponse.json(
      resumesAt !== undefined ? { ok: true, resumes_at: resumesAt } : { ok: true }
    );
  } catch (err) {
    console.error("whop/pause: error", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
