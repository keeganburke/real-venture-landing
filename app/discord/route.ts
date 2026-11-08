import { NextRequest, NextResponse } from "next/server";
import { guestStartPath } from "../../lib/discord-guest-link";

// realventure.io/discord — the short, shareable entry to the free Discord door.
// A 302 to the guest OAuth start, carrying the attribution params (src, cid)
// through so the callback can stamp the lead's GHL contact.
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const target = new URL(guestStartPath(request.nextUrl.searchParams), request.url);
  return NextResponse.redirect(target, 302);
}
