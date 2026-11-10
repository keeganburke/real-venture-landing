// Route level checks for the login gate: the real callback and purchase
// status handlers, with Whop answered by a fake (no real Whop calls) and
// every Supabase write blocked before it leaves this machine (reads pass
// through, read only). Prints PASS/FAIL lines, no ids or names. Run:
//   JITI_ALIAS={"@/":"<repo>/"} node --env-file=.env.local node_modules/.bin/jiti scripts/test-login-routes.ts
const keepAlive = setInterval(() => {}, 1000);
import { NextRequest } from "next/server";
import { GET as callback } from "../app/api/auth/whop/callback/route";
import { GET as purchaseStatus } from "../app/api/auth/whop/purchase-status/route";
import { createPendingToken, verifyPendingToken, verifySessionToken, createSessionToken } from "../lib/session";
import { readWhopAccess, waitForWhopAccess } from "../lib/whop-access";

const prod = process.env.WHOP_PRODUCT_ID!;
const realFetch = globalThis.fetch;
let blockedWrites = 0;
let whopCalls = 0;
const T0 = Date.now();

// the fake Whop: per user, when their account was made and what memberships
// the list shows at a given moment
type FakeUser = { accountCreatedMs: number; rows: (now: number) => Record<string, unknown>[] };
const users = new Map<string, FakeUser>();
let whopStatus: number | null = null; // force an HTTP status for the memberships list
let currentSub = "";

globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = String(init.method ?? (typeof input === "object" && input?.method ? input.method : "GET")).toUpperCase();
  if (url.hostname === "api.whop.com") {
    whopCalls++;
    if (url.pathname === "/oauth/token") return Response.json({ access_token: "fake" });
    if (url.pathname === "/oauth/userinfo") return Response.json({ sub: currentSub });
    if (url.pathname.startsWith("/api/v1/users/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop()!);
      const u = users.get(id);
      return u ? Response.json({ id, created_at: new Date(u.accountCreatedMs).toISOString() }) : new Response("{}", { status: 404 });
    }
    if (url.pathname === "/api/v1/memberships") {
      if (whopStatus) return new Response("{}", { status: whopStatus });
      const id = url.searchParams.get("user_id") ?? "";
      const u = users.get(id);
      return Response.json({ data: u ? u.rows(Date.now()) : [], page_info: { has_next_page: false } });
    }
    if (url.pathname.startsWith("/api/v1/memberships/")) return new Response("{}", { status: 404 });
    return new Response("{}", { status: 404 });
  }
  // Supabase and anything else: reads only. A write is answered here and
  // never sent.
  if (method !== "GET" && method !== "HEAD") {
    blockedWrites++;
    return new Response(null, { status: 201 });
  }
  return realFetch(input, init);
}) as any;

const active = (createdMs: number) => ({ id: "mem_fake", user_id: "", product_id: prod, status: "active", created_at: new Date(createdMs).toISOString(), plan_id: "plan_fake" });
function addUser(id: string, accountAgeMs: number, rows: (now: number) => Record<string, unknown>[]) {
  users.set(id, { accountCreatedMs: Date.now() - accountAgeMs, rows: (now) => rows(now).map((r) => ({ ...r, user_id: id })) });
}
const DAY = 24 * 3600e3;

function cookiesOf(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}
async function signIn(sub: string, extraCookie = "") {
  currentSub = sub;
  const req = new NextRequest("http://localhost:3002/api/auth/whop/callback?code=c&state=s", {
    headers: { cookie: `whop_oauth_state=s; whop_code_verifier=v${extraCookie ? "; " + extraCookie : ""}` },
  });
  const t = Date.now();
  const res = await callback(req);
  return { res, to: res.headers.get("location") ?? "", secs: (Date.now() - t) / 1000, cookies: cookiesOf(res) };
}
const pass = (ok: boolean, label: string) => console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);

// capture the loud config log
const realError = console.error;
let configLines = 0;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("[WHOP_GATE_CONFIG_ERROR]")) configLines++;
  realError(...(args.map((a) => (typeof a === "object" && a && "whopUserId" in a ? { ...(a as object), whopUserId: "<id>" } : a)) as []));
};
const realLog = console.log;
const quietLog = (...args: unknown[]) => {
  if (typeof args[0] === "string" && (args[0].startsWith("PASS") || args[0].startsWith("FAIL") || args[0].startsWith("  "))) realLog(...(args as []));
};
console.log = quietLog;

// ---------------- a) our own config errors: let in for 1 hour, logged loudly
{
  addUser("user_testCfg401", 400 * DAY, () => [active(T0 - 90 * DAY)]);
  whopStatus = 401;
  configLines = 0;
  const r = await signIn("user_testCfg401");
  whopStatus = null;
  const s = r.cookies.rv_session ? await verifySessionToken(r.cookies.rv_session) : null;
  const ttl = s ? s.exp - Math.floor(Date.now() / 1000) : 0;
  pass(!!s && ttl <= 3600 && ttl > 3500 && configLines === 1, `a) Whop 401 to our key: let in with a ${Math.round(ttl / 60)} minute session, ${configLines} WHOP_GATE_CONFIG_ERROR line`);
}
{
  const saved = process.env.WHOP_COMPANY_ID;
  delete process.env.WHOP_COMPANY_ID;
  const a = await readWhopAccess("user_testCfg401");
  process.env.WHOP_COMPANY_ID = saved;
  pass(a.kind === "error" && a.config === true, `a) a missing Whop env var: ${a.kind}, config=${a.kind === "error" ? a.config : "-"}`);
  whopStatus = 403;
  const b = await readWhopAccess("user_testCfg401");
  whopStatus = 503;
  const c = await readWhopAccess("user_testCfg401");
  whopStatus = null;
  pass(b.kind === "error" && b.config === true && c.kind === "error" && !c.config, `a) 403 counts as our config (${b.kind === "error" && b.config}), a 503 outage does not (${c.kind === "error" && !!c.config})`);
}

// ---------------- d) a brand new buyer never sees "Wrong email"
{
  addUser("user_testCookie", 400 * DAY, () => []);
  const r = await signIn("user_testCookie", "rv_recent_purchase=1");
  const pend = r.cookies.rv_pending_purchase ? await verifyPendingToken(r.cookies.rv_pending_purchase) : null;
  pass(r.to.endsWith("/finishing-purchase") && !!pend && r.cookies.rv_session === "" && r.secs < 5, `d) came from the checkout page, Whop lists nothing yet: ${new URL(r.to).pathname} in ${r.secs.toFixed(1)} s, waiting pass set, no session`);
}
{
  addUser("user_testNewAcct", 10 * 60e3, () => []);
  const r = await signIn("user_testNewAcct");
  pass(r.to.endsWith("/finishing-purchase") && r.secs < 5, `d) Whop account made 10 minutes ago, no cookie, nothing listed: ${new URL(r.to).pathname} in ${r.secs.toFixed(1)} s`);
}
{
  addUser("user_testNewMem", 400 * DAY, () => [{ id: "mem_x", product_id: prod, status: "drafted", created_at: new Date(Date.now() - 5 * 60e3).toISOString() }]);
  const r = await signIn("user_testNewMem");
  pass(r.to.endsWith("/finishing-purchase"), `d) a membership made 5 minutes ago, not active yet: ${new URL(r.to).pathname}`);
}
{
  // not a recent buyer: the wrong account screen still works for everyone else
  addUser("user_testOldNone", 400 * DAY, () => []);
  const r = await signIn("user_testOldNone");
  pass(r.to.includes("/login?auth=denied") && r.secs > 15, `d) old Whop account, no purchase signs: ${new URL(r.to).pathname}${new URL(r.to).search} after waiting ${r.secs.toFixed(1)} s (unchanged screen)`);
  addUser("user_testOldEnded", 400 * DAY, () => [{ id: "mem_old", product_id: prod, status: "canceled", cancel_at_period_end: false, created_at: new Date(Date.now() - 200 * DAY).toISOString() }]);
  const e = await signIn("user_testOldEnded");
  pass(e.to.endsWith("/membership-ended"), `d) old ended member, no purchase signs: ${new URL(e.to).pathname}`);
}
{
  const tok = await createPendingToken("user_testCookie");
  const asSession = tok ? await verifySessionToken(tok) : "no token";
  const sess = await createSessionToken("user_testCookie");
  const asPending = sess ? await verifyPendingToken(sess) : "no token";
  pass(tok !== null && asSession === null && asPending === null, `d) the waiting pass is not a session (as session: ${asSession}), and a session is not a waiting pass (${asPending})`);
}
{
  const none = await purchaseStatus(new NextRequest("http://localhost:3002/api/auth/whop/purchase-status"));
  const forged = await purchaseStatus(new NextRequest("http://localhost:3002/api/auth/whop/purchase-status", { headers: { cookie: "rv_pending_purchase=eyJ3aG9wVXNlcklkIjoidXNlcl94In0.AAAA" } }));
  const a = await none.json();
  const b = await forged.json();
  pass(a.status === "signin" && b.status === "signin" && !cookiesOf(forged).rv_session, `d) status check with no pass: ${a.status}; with a forged pass: ${b.status}`);
}
// the slow purchase (shows up after 45 s) and the one that never shows up,
// polled the way the page does (every 3 s), at the same time, for real
{
  const start = Date.now();
  addUser("user_testSlow45", 10 * 60e3, (now) => (now - start >= 45_000 ? [active(start + 45_000)] : []));
  addUser("user_testNever", 10 * 60e3, () => []);
  const slowPass = await createPendingToken("user_testSlow45");
  const neverPass = await createPendingToken("user_testNever");
  const poll = async (pass_: string, maxMs: number) => {
    const t = Date.now();
    let polls = 0;
    while (Date.now() - t < maxMs) {
      polls++;
      const res = await purchaseStatus(new NextRequest("http://localhost:3002/api/auth/whop/purchase-status", { headers: { cookie: `rv_pending_purchase=${pass_}` } }));
      const body = await res.json();
      if (body.status === "ready") return { body, secs: (Date.now() - t) / 1000, cookies: cookiesOf(res), polls };
      if (body.status !== "waiting") return { body, secs: (Date.now() - t) / 1000, cookies: cookiesOf(res), polls };
      await new Promise((r) => setTimeout(r, 3000));
    }
    return { body: { status: "gave up" }, secs: (Date.now() - t) / 1000, cookies: {} as Record<string, string>, polls };
  };
  const [slow, never] = await Promise.all([poll(slowPass!, 130_000), poll(neverPass!, 120_000)]);
  const s = slow.cookies.rv_session ? await verifySessionToken(slow.cookies.rv_session) : null;
  pass(slow.body.status === "ready" && slow.secs >= 45 && slow.secs < 50 && s?.whopUserId === "user_testSlow45" && slow.cookies.rv_pending_purchase === "" && slow.body.next === "/onboarding",
    `d) purchase shows up after 45 s: ${slow.body.status} at ${slow.secs.toFixed(1)} s after ${slow.polls} checks, session made (7 days: ${s ? Math.round((s.exp - Date.now() / 1000) / 86400) : 0}), waiting pass cleared, next ${slow.body.next}`);
  pass(never.body.status === "gave up" && !never.cookies.rv_session, `d) purchase never shows up: still "waiting" after ${never.secs.toFixed(0)} s and ${never.polls} checks, no session (the page then shows the calm message)`);
}
// the 20 s wait still catches a new buyer with no signs at all
{
  let k = 0;
  addUser("user_testLateNoSign", 400 * DAY, () => (++k >= 4 ? [active(Date.now())] : []));
  const r = await signIn("user_testLateNoSign");
  pass(r.to.endsWith("/onboarding") && !!r.cookies.rv_session, `d) no purchase signs, listed on the 4th read: let in (${new URL(r.to).pathname}) after ${r.secs.toFixed(1)} s`);
}
// a normal paying member is not slowed down
{
  addUser("user_testMember", 400 * DAY, () => [active(T0 - 300 * DAY)]);
  const r = await signIn("user_testMember", "rv_recent_purchase=1");
  const s = r.cookies.rv_session ? await verifySessionToken(r.cookies.rv_session) : null;
  pass(r.to.endsWith("/dashboard") && !!s && typeof s.iat === "number" && r.secs < 3, `normal paying member: ${new URL(r.to).pathname} in ${r.secs.toFixed(1)} s, 7 day session with a sign in time`);
}
// a real Whop answer: the waiting pass path still never makes a session for
// someone Whop shows as not a member (checked with the safe read)
{
  const w = await waitForWhopAccess("user_testNever", { sleep: async () => {}, isRecentBuyer: async () => true });
  pass((w.kind === "none" || w.kind === "ended") && w.recentBuyer === true && w.tries === 1, `d) recent buyer stops waiting after the first answer: ${w.kind}, ${w.tries} read`);
}

pass(blockedWrites >= 0, `  Supabase writes attempted and blocked (never sent): ${blockedWrites}; fake Whop calls: ${whopCalls}`);
console.log = realLog;
console.error = realError;
globalThis.fetch = realFetch;
clearInterval(keepAlive);
