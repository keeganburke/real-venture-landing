import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isAdmin } from "../../../../lib/admin-allowlist";

export const dynamic = "force-dynamic";

const INTAKE_COLUMNS =
  "whop_user_id, display_name, intake_dream, intake_hours, intake_tried, intake_tried_failure, intake_worry, intake_identity, intake_invest, intake_seriousness, intake_completed_at";

// JSON feed of completed onboarding intakes, each row carrying its Discord
// connection (or null). Same allowlist gate as the page; non-admins get a
// bare 403. The join is done in code: discord_connections has no foreign key
// to member_profiles, so PostgREST cannot embed it.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session?.whopUserId || !isAdmin(session.whopUserId)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const [profilesRes, discordRes] = await Promise.all([
    supabase
      .from("member_profiles")
      .select(INTAKE_COLUMNS)
      .not("intake_completed_at", "is", null)
      .order("intake_completed_at", { ascending: false }),
    supabase.from("discord_connections").select("whop_user_id, discord_user_id, connected_at"),
  ]);

  if (profilesRes.error) {
    console.error("[admin/onboarding] supabase read failed", profilesRes.error.message);
    return NextResponse.json({ ok: false, error: "read failed" }, { status: 500 });
  }
  if (discordRes.error) {
    // Degrade: rows still return, just without Discord data.
    console.error("[admin/onboarding] discord_connections read failed", discordRes.error.message);
  }

  const discordByUser = new Map<string, { discord_user_id: string; connected_at: string }>();
  for (const dc of discordRes.data ?? []) {
    discordByUser.set(dc.whop_user_id, {
      discord_user_id: dc.discord_user_id,
      connected_at: dc.connected_at,
    });
  }
  const rows = (profilesRes.data ?? []).map((p) => ({
    ...p,
    discord_connections: discordByUser.get(p.whop_user_id) ?? null,
  }));

  return NextResponse.json({ ok: true, rows });
}
