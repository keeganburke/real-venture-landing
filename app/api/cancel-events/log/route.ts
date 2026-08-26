import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";

const EVENT_TYPES = [
  "cancel_flow_started",
  "reason_selected",
  "pause_offered",
  "pause_accepted",
  "pause_declined",
  "free_days_offered",
  "free_days_accepted",
  "free_days_declined",
  "loss_screen_viewed",
  "testimonial_shown",
  "kept_plan",
  "proceeded_to_cancel",
  "redirected_to_whop",
  "whop_cancel_completed",
  "churned_after_flow",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ok = () => NextResponse.json({ ok: true });

// Fire and forget analytics. Retention > analytics: every failure path logs
// to the server console and still returns 200 so the cancel flow never blocks.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      console.error("cancel-events/log: invalid body");
      return ok();
    }

    const eventType = body.event_type;
    const sessionId = body.session_id;
    if (typeof eventType !== "string" || !EVENT_TYPES.includes(eventType)) {
      console.error("cancel-events/log: unknown event_type", eventType);
      return ok();
    }
    if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
      console.error("cancel-events/log: invalid session_id");
      return ok();
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      console.error("cancel-events/log: no valid rv_session, skipping insert");
      return ok();
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("cancel_flow_events").insert({
      user_id: session.whopUserId,
      membership_id: typeof body.membership_id === "string" ? body.membership_id : null,
      session_id: sessionId,
      plan: typeof body.plan === "string" ? body.plan : null,
      event_type: eventType,
      event_data: body.event_data ?? null,
    });
    if (error) console.error("cancel-events/log: insert failed", error.message);
  } catch (err) {
    console.error("cancel-events/log: error", err);
  }
  return ok();
}
