import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { isAdmin } from "../../../../lib/admin-allowlist";
import {
  AdminOnboardingTable,
  type AdminOnboardingRow,
  type DiscordConnection,
} from "./AdminOnboardingTable";

export const dynamic = "force-dynamic";

const INTAKE_COLUMNS =
  "whop_user_id, display_name, intake_dream, intake_hours, intake_tried, intake_tried_failure, intake_worry, intake_identity, intake_invest, intake_seriousness, intake_completed_at";

export default async function AdminOnboardingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session?.whopUserId) {
    redirect("/api/auth/whop/start");
  }

  if (!isAdmin(session.whopUserId)) {
    // Silently redirect non-admins to the hub. No error page, keep the
    // surface invisible.
    redirect("/dashboard");
  }

  // discord_connections has no foreign key to member_profiles (migration 011
  // keys both on whop_user_id but declares no reference), so PostgREST cannot
  // embed it. Two reads merged in code instead; same nested shape the table
  // expects.
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
    console.error("[admin/onboarding page] member_profiles read failed", profilesRes.error.message);
  }
  if (discordRes.error) {
    console.error("[admin/onboarding page] discord_connections read failed", discordRes.error.message);
  }

  const discordByUser = new Map<string, DiscordConnection>();
  for (const dc of discordRes.data ?? []) {
    discordByUser.set(dc.whop_user_id, {
      discord_user_id: dc.discord_user_id,
      connected_at: dc.connected_at,
    });
  }
  const rows: AdminOnboardingRow[] = (profilesRes.data ?? []).map((p) => ({
    ...(p as Omit<AdminOnboardingRow, "discord_connections">),
    discord_connections: discordByUser.get(p.whop_user_id) ?? null,
  }));

  return (
    <div className="admin-page">
      <div className="admin-nav">
        <Link href="/dashboard/admin/onboarding" className="admin-nav-link active">Onboarding</Link>
        <Link href="/dashboard/admin/discord" className="admin-nav-link">Discord</Link>
      </div>
      <div className="admin-header">
        <h1 className="admin-title">Onboarding Responses</h1>
        <div className="admin-count">{rows.length} completed</div>
      </div>
      <AdminOnboardingTable rows={rows} />
    </div>
  );
}
