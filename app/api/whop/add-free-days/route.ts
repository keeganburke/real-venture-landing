import { NextRequest, NextResponse } from "next/server";
import { getActiveMembershipId, whopAuthHeaders } from "../whop-membership";

// Adds free days to the caller's membership via Whop. Path confirmed against
// Whop's official docs: POST /api/v1/memberships/{id}/add_free_days with
// body { free_days: n } (integer, 1-1095). Returns the full Membership
// object on success.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (body?.days !== 15) {
      return NextResponse.json({ ok: false, error: "invalid days" }, { status: 400 });
    }

    const lookup = await getActiveMembershipId(request);
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });
    }

    const res = await fetch(
      `https://api.whop.com/api/v1/memberships/${lookup.membershipId}/add_free_days`,
      {
        method: "POST",
        headers: whopAuthHeaders(),
        body: JSON.stringify({ free_days: 15 }),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data?.error?.message ?? data?.error ?? `whop add_free_days failed (${res.status})`;
      console.error("whop/add-free-days: whop error", message);
      return NextResponse.json({ ok: false, error: String(message) });
    }

    // TODO: confirm the real field name on a live response.
    const newRenewal = data?.renewal_period_end ?? data?.expires_at ?? undefined;
    return NextResponse.json(
      newRenewal !== undefined ? { ok: true, new_renewal_date: newRenewal } : { ok: true }
    );
  } catch (err) {
    console.error("whop/add-free-days: error", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
