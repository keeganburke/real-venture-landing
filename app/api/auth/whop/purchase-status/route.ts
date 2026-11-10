import { NextRequest, NextResponse } from "next/server";
import { PENDING_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, verifyPendingToken, verifySessionToken } from "@/lib/session";
import { hubAllowlisted, readWhopAccess, RECENT_PURCHASE_COOKIE, rememberMember } from "@/lib/whop-access";
import { completeLogin } from "@/lib/whop-login";

// What /finishing-purchase asks every few seconds: "has Whop listed my
// purchase yet?" The person is known from one of two cookies:
//   rv_pending_purchase  the waiting pass the login callback gives a buyer
//                        whose membership Whop doesn't list yet (lib/session)
//   rv_session           a signed in member the hub's re-check sent here
// Answers, always 200 and never cached:
//   { status: "ready", next }  Whop lists a membership that grants access.
//                              For a waiting pass this is where the session
//                              is made (the same as a normal sign in).
//   { status: "waiting" }      not yet (also when Whop errors: keep waiting)
//   { status: "signin" }       no pass and no session: sign in again
// It never lets anyone in without a membership Whop lists as theirs.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
// one Whop read per person every 2 seconds at most, whatever the page does
const MIN_GAP_MS = 2000;
const lastAsked = new Map<string, number>();

function answer(body: Record<string, unknown>) {
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const pendingRaw = request.cookies.get(PENDING_COOKIE_NAME)?.value;
  const sessionRaw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const pending = pendingRaw ? await verifyPendingToken(pendingRaw) : null;
  const session = !pending && sessionRaw ? await verifySessionToken(sessionRaw) : null;
  const whopUserId = pending?.whopUserId ?? session?.whopUserId;
  if (!whopUserId) return answer({ status: "signin" });

  const now = Date.now();
  const last = lastAsked.get(whopUserId);
  if (last !== undefined && now - last < MIN_GAP_MS) return answer({ status: "waiting" });
  if (lastAsked.size > 5000) lastAsked.clear();
  lastAsked.set(whopUserId, now);

  const access = await readWhopAccess(whopUserId, { timeoutMs: 6000 });
  const granted = access.kind === "member" || ((access.kind === "ended" || access.kind === "none") && (await hubAllowlisted(whopUserId)));
  if (!granted) {
    if (access.kind === "error") console.error("[whop/purchase-status] Whop could not answer, still waiting", { whopUserId, reason: access.reason });
    return answer({ status: "waiting" });
  }

  rememberMember(whopUserId);
  if (!pending) {
    // already signed in (sent here by the hub): the hub will let them in now
    console.log("[whop/purchase-status] purchase listed, back to the hub", { whopUserId });
    return answer({ status: "ready", next: "/dashboard" });
  }

  console.log("[whop/purchase-status] purchase listed, signing in", { whopUserId, waitedMs: now - pending.since });
  const oldest = access.kind === "member" ? access.oldestCreatedAtMs : null;
  const response = await completeLogin(whopUserId, oldest, SESSION_TTL_SECONDS, (path) => answer({ status: "ready", next: path }));
  if (!response) return answer({ status: "waiting" });
  response.cookies.set(PENDING_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  response.cookies.set(RECENT_PURCHASE_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
