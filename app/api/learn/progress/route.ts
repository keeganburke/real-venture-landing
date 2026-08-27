import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";

// POST { lessonId, action: "start" | "complete" }
// Session verification on every mutating call (standing rule); the service-role
// client bypasses RLS, so user identity comes only from the verified cookie.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { lessonId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  const action = body.action === "start" || body.action === "complete" ? body.action : null;
  if (!lessonId || !action) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row: Record<string, string> = {
    user_id: session.whopUserId,
    lesson_id: lessonId,
    last_seen_at: now,
  };
  // "start" never touches completed_at; upsert only updates supplied columns.
  if (action === "complete") {
    row.completed_at = now;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_lesson_progress")
    .upsert(row, { onConflict: "user_id,lesson_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, progress: data });
}
