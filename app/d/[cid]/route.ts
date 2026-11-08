import { NextRequest, NextResponse } from "next/server";
import { dAliasTarget } from "../../../lib/discord-free-ui";

// realventure.io/d/<cid> — a short SMS alias. Behaves exactly like
// /discord?src=sms&cid=<cid>: it 302s to /discord, which starts the guest
// OAuth and encodes the same state (s="sms", c=<cid>). A cid that is not a
// valid GHL contact id falls back to /discord?src=sms with no cid, so a
// mistyped or guessed link never carries a junk id. /discord is unchanged.
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> },
) {
  const { cid } = await params;
  return NextResponse.redirect(new URL(dAliasTarget(cid), request.url), 302);
}
