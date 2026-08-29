import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";
import { getWhopMemberSummary } from "../../../../lib/whop-member";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("member_profiles")
    .select("*")
    .eq("whop_user_id", session.whopUserId)
    .maybeSingle();

  const whopMember = await getWhopMemberSummary(session.whopUserId);
  const tier = whopMember.tier ?? "Member";
  const email = whopMember.email;

  return NextResponse.json({
    ok: true,
    profile: {
      displayName: data?.display_name ?? "",
      phone: data?.phone ?? "",
      timezone: data?.timezone ?? "America/Los_Angeles",
      headline: data?.headline ?? "",
      bio: data?.bio ?? "",
      photoUrl: data?.photo_url ?? null,
    },
    tier,
    email,
    whopPhotoUrl: whopMember.photoUrl,
  });
}
