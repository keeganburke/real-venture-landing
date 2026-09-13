import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isAdmin } from "../../../../lib/admin-allowlist";
import { AdminDiscordTable, type AdminDiscordRow } from "./AdminDiscordTable";

export const dynamic = "force-dynamic";

export default async function AdminDiscordPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session?.whopUserId) {
    redirect("/api/auth/whop/start");
  }
  if (!isAdmin(session.whopUserId)) {
    redirect("/dashboard");
  }

  // No FK between the tables (migration 011), so the join happens here.
  const supabase = createAdminClient();
  const [profilesRes, discordRes] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("whop_user_id, display_name, created_at, whop_joined_at, intake_completed_at, whop_tier, whop_plan_id, whop_display_name, whop_username")
      // Real Whop join date (migration 016), kept current by the backfill.
      // nullsFirst:false keeps any un-backfilled rows at the bottom instead
      // of Postgres's DESC default of nulls on top.
      .order("whop_joined_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("discord_connections")
      .select("whop_user_id, discord_user_id, discord_username, tier, role_id, connected_at"),
  ]);
  if (profilesRes.error) {
    console.error("[admin/discord page] member_profiles read failed", profilesRes.error.message);
  }
  if (discordRes.error) {
    console.error("[admin/discord page] discord_connections read failed", discordRes.error.message);
  }

  const discordByUser = new Map<string, AdminDiscordRow["discord_connections"]>();
  for (const dc of discordRes.data ?? []) {
    discordByUser.set(dc.whop_user_id, {
      discord_user_id: dc.discord_user_id,
      discord_username: dc.discord_username ?? null,
      tier: dc.tier ?? null,
      role_id: dc.role_id ?? null,
      connected_at: dc.connected_at,
    });
  }
  const rows: AdminDiscordRow[] = (profilesRes.data ?? []).map((p) => ({
    whop_user_id: p.whop_user_id,
    display_name: p.display_name ?? null,
    created_at: p.created_at ?? null,
    whop_joined_at: p.whop_joined_at ?? null,
    intake_completed_at: p.intake_completed_at ?? null,
    // Cached from Whop by the backfill (migration 018). Null until the
    // script has run against the new columns.
    whop_tier: p.whop_tier ?? null,
    whop_plan_id: p.whop_plan_id ?? null,
    // Cached Whop identity (migration 019), backfilled from the membership's user record.
    whop_display_name: p.whop_display_name ?? null,
    whop_username: p.whop_username ?? null,
    discord_connections: discordByUser.get(p.whop_user_id) ?? null,
  }));

  const total = rows.length;
  const connected = rows.filter((r) => r.discord_connections).length;
  const pct = total === 0 ? 0 : Math.round((connected / total) * 100);

  return (
    <div className="admin-page">
      <div className="admin-nav">
        <Link href="/dashboard/admin/onboarding" className="admin-nav-link">Onboarding</Link>
        <Link href="/dashboard/admin/discord" className="admin-nav-link active">Discord</Link>
      </div>
      <div className="admin-header">
        <h1 className="admin-title">Discord Connection Status</h1>
      </div>
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total members</div>
          <div className="admin-stat-value">{total}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Connected to Discord</div>
          <div className="admin-stat-value gold">
            {connected} <span style={{ fontSize: "14px", fontWeight: 700 }}>({pct}%)</span>
          </div>
        </div>
      </div>
      <AdminDiscordTable rows={rows} />
    </div>
  );
}
