import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Upsert, not update: member_profiles rows only exist once someone saves a
  // profile, and an update against a missing row affects zero rows silently --
  // the tour would then replay on every visit forever.
  const supabase = createAdminClient();
  const { error } = await supabase.from("member_profiles").upsert(
    {
      whop_user_id: session.whopUserId,
      spotlight_completed_at: new Date().toISOString(),
    },
    { onConflict: "whop_user_id" }
  );

  if (error) {
    console.error("[tour/complete] update failed", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
