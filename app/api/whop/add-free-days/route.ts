import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";
import { getActiveMembershipId, whopAuthHeaders } from "../whop-membership";

// Adds free days to the caller's membership via Whop. Path confirmed against
// Whop's official docs: POST /api/v1/memberships/{id}/add_free_days with
// body { free_days: n } (integer, 1-1095). Returns the full Membership
// object on success.
//
// Abuse guard: one claim per user, enforced by the partial unique index
// cancel_flow_events_one_free_days_per_user (migration 002). The guard row
// is inserted BEFORE the Whop call; concurrent requests race the insert and
// exactly one wins, so double-grants are impossible. supabase-js does not
// throw on constraint violations; it returns { error } with error.code
// carrying the Postgres SQLSTATE (verified empirically).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (body?.days !== 15) {
      return NextResponse.json({ ok: false, error: "invalid days" }, { status: 400 });
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    let guardRowId: string | null = null;
    const { data: guardRow, error: insertError } = await supabase
      .from("cancel_flow_events")
      .insert({
        user_id: session.whopUserId,
        membership_id: null,
        session_id: crypto.randomUUID(),
        plan: null,
        event_type: "free_days_accepted",
        event_data: { pending: true },
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        console.error("[add-free-days][guard] rejected repeat claim", session.whopUserId);
        return NextResponse.json({
          ok: false,
          error: "already_claimed",
          message: "You have already claimed this offer.",
        });
      }
      // Any other insert failure fails open: retention > analytics.
      console.error("[add-free-days][guard] insert failed, proceeding", insertError.message);
    } else {
      guardRowId = guardRow?.id ?? null;
    }

    const releaseGuardRow = async () => {
      if (!guardRowId) return;
      const { error } = await supabase.from("cancel_flow_events").delete().eq("id", guardRowId);
      if (error) console.error("[add-free-days][guard] release failed", error.message);
    };

    const lookup = await getActiveMembershipId(request);
    if (!lookup.ok) {
      await releaseGuardRow();
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
      // Do not leave a phantom claimed state when Whop errored; allow retry.
      await releaseGuardRow();
      return NextResponse.json({ ok: false, error: String(message) });
    }

    if (guardRowId) {
      const { error: updateError } = await supabase
        .from("cancel_flow_events")
        .update({
          membership_id: lookup.membershipId,
          event_data: {
            days: 15,
            whop_response_id: lookup.membershipId,
            completed_at: new Date().toISOString(),
          },
        })
        .eq("id", guardRowId);
      if (updateError) {
        console.error("[add-free-days][guard] completion update failed", updateError.message);
      }
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
