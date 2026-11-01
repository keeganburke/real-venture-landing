import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { FALLBACK_LINK } from "../../../lib/payment-recovery";

// Payment-recovery tracked link: /r/<token> (migration 031). Logs the click
// (time, channel, message number) and redirects to the member's real Whop
// manage_url stored with the token. Unknown or malformed token: redirect to
// the generic Whop memberships page, log nothing. Never cached.
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

function go(url: string): NextResponse {
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) return go(FALLBACK_LINK);
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("payment_recovery_links")
      .select("token, target_url, channel, message_number, click_count, first_clicked_at")
      .eq("token", token)
      .maybeSingle();
    if (error || !data || typeof data.target_url !== "string") {
      if (error) console.error("[r] link read failed", error.message);
      return go(FALLBACK_LINK);
    }
    const now = new Date().toISOString();
    const [click, bump] = await Promise.all([
      supabase.from("payment_recovery_clicks").insert({ token, channel: data.channel, message_number: data.message_number }),
      supabase
        .from("payment_recovery_links")
        .update({ click_count: Number(data.click_count ?? 0) + 1, first_clicked_at: data.first_clicked_at ?? now, last_clicked_at: now })
        .eq("token", token),
    ]);
    if (click.error) console.error("[r] click insert failed", click.error.message);
    if (bump.error) console.error("[r] link update failed", bump.error.message);
    return go(data.target_url);
  } catch (err) {
    console.error("[r] threw", err instanceof Error ? err.message : "unknown");
    return go(FALLBACK_LINK);
  }
}
