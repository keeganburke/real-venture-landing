// READ ONLY dry run of the login gate (lib/whop-access.ts) against live Whop
// data: GETs only, prints counts, never ids or names. Run before SHIP:
//   JITI_ALIAS={"@/":"<repo>/"} node --env-file=.env.local node_modules/.bin/jiti scripts/dryrun-login-gate.ts
// against live Whop data. GETs only. Prints counts, never ids or names.
import fs from "node:fs";
// a server keeps its event loop alive; this script has to do it itself so
// AbortSignal.timeout can fire
const keepAlive = setInterval(() => {}, 1000);
import { readWhopAccess, waitForWhopAccess, dashboardAccess, grantsAccess, hadMembership, hubAllowlisted } from "../lib/whop-access";
const { WHOP_PRODUCT_ID: prod, WHOP_COMPANY_ID: co, WHOP_API_KEY: key } = process.env;
const LIVE = ["active", "trialing", "completed", "past_due"];
const all: any[] = []; let after: string | null = null;
for (let i = 0; i < 100; i++) {
  const p = new URLSearchParams({ company_id: co!, product_id: prod!, first: "100" }); if (after) p.set("after", after);
  const j: any = await (await fetch(`https://api.whop.com/api/v1/memberships?${p}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Api-Version-Date": "2026-10-15-1" }, signal: AbortSignal.timeout(30000) })).json();
  all.push(...(j.data ?? [])); if (!j.page_info?.has_next_page) break; after = j.page_info.end_cursor;
}
const by = new Map<string, any[]>(); for (const m of all) if (m.product_id === prod) by.set(m.user_id, [...(by.get(m.user_id) ?? []), m]);
const pick = (f: (ms: any[]) => boolean, n: number) => [...by.entries()].filter(([, ms]) => f(ms)).slice(0, n).map(([u]) => u);
const activeU = pick((ms) => ms.some((m) => m.status === "active"), 20);
// ended = nothing that grants access (not by status alone: a cancel at period
// end with paid time left is still a member)
const endedU = pick((ms) => !ms.some((m) => grantsAccess(m)), 20);
const pastDueU = pick((ms) => ms.some((m) => m.status === "past_due") && !ms.some((m) => ["active", "trialing", "completed"].includes(m.status)), 20);
const since = Date.now() - 48 * 3600e3;
const newest = all.filter((m) => m.product_id === prod && new Date(m.created_at).getTime() > since).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 10);
const admin = fs.readFileSync(new URL("../lib/admin-allowlist.ts", import.meta.url), "utf8").match(/"(user_[A-Za-z0-9]+)"/)![1];
const tally = async (label: string, ids: string[], want: string) => {
  const c: Record<string, number> = {};
  for (const u of ids) { const a = await readWhopAccess(u); c[a.kind] = (c[a.kind] ?? 0) + 1; }
  const ok = (c[want] ?? 0) === ids.length;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${ids.length} checked -> ${JSON.stringify(c)} (want all ${want})`);
};
await tally("test admin", [admin], "member");
await tally("active members", activeU, "member");
await tally("ended members", endedU, "ended");
await tally("past_due only (grace)", pastDueU, "member");
await tally("made up ids", ["user_ZZZZnotarealuser01", "user_notadmin00000"], "none");
const newestStatus: Record<string, number> = {}; for (const m of newest) newestStatus[m.status] = (newestStatus[m.status] ?? 0) + 1;
console.log(`      newest memberships in the last 48h: ${newest.length}, statuses ${JSON.stringify(newestStatus)}`);
await tally("owners of the 10 newest memberships (live ones)", newest.filter((m) => LIVE.includes(m.status)).map((m) => m.user_id), "member");
// canceled at period end with paid time left: still a member (Discord's rule)
const nowMs = Date.now();
const paidLeftU = [...by.entries()].filter(([, ms]) => !ms.some((m) => LIVE.includes(m.status)) && ms.some((m) => grantsAccess(m, nowMs))).map(([u]) => u);
await tally("canceled at period end, paid time left", paidLeftU, "member");
// a definite "no" then a Whop error: the "no" stands (no let-in on a lucky error)
{
  const realF = globalThis.fetch; let k = 0;
  globalThis.fetch = (async (url: any, init: any) => { k++; return k === 1 ? realF(url, init) : new Response("down", { status: 503 }); }) as any;
  const r = await waitForWhopAccess(endedU[0], { sleep: async () => {} });
  globalThis.fetch = realF;
  console.log(`${r.kind === "ended" ? "PASS" : "FAIL"}  ended, then Whop errors on the retries: ${r.kind} after ${r.tries} reads (no let-in)`);
}
// strangers' rows plus the caller's own live row: member
{
  const realF = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ data: [{ user_id: "user_someoneelse", product_id: prod, status: "canceled" }, { user_id: activeU[0], product_id: prod, status: "active", created_at: "2026-09-01T00:00:00Z" }] }), { status: 200 })) as any;
  const r = await readWhopAccess(activeU[0]);
  globalThis.fetch = realF;
  console.log(`${r.kind === "member" ? "PASS" : "FAIL"}  strangers' rows plus the caller's own active row: ${r.kind}`);
}
// the live membership is on page 2: still a member
{
  const realF = globalThis.fetch; let k = 0;
  globalThis.fetch = (async () => { k++; return new Response(JSON.stringify(k === 1
    ? { data: [{ user_id: activeU[0], product_id: prod, status: "canceled" }], page_info: { has_next_page: true, end_cursor: "c1" } }
    : { data: [{ user_id: activeU[0], product_id: prod, status: "active" }], page_info: { has_next_page: false } }), { status: 200 }); }) as any;
  const r = await readWhopAccess(activeU[0]);
  globalThis.fetch = realF;
  console.log(`${r.kind === "member" && k === 2 ? "PASS" : "FAIL"}  live membership on the second page: ${r.kind} after ${k} pages`);
}
// one blip, then a real answer: the real answer wins (no lucky let in)
{
  const realF = globalThis.fetch; let k = 0;
  globalThis.fetch = (async (url: any, init: any) => { k++; return k === 1 ? new Response("slow down", { status: 429 }) : realF(url, init); }) as any;
  const r = await waitForWhopAccess(endedU[0], { sleep: async () => {} });
  globalThis.fetch = realF;
  console.log(`${r.kind === "ended" ? "PASS" : "FAIL"}  a 429 then a real answer for an ended member: ${r.kind} (not let in)`);
}
const hm1 = await hadMembership(activeU[0]); const hm2 = await hadMembership("user_ZZZZnotarealuser01");
console.log(`${!hm2 ? "PASS" : "FAIL"}  member record check: a made-up id has none (${hm2}); a real member: ${hm1}`);
const al = await hubAllowlisted("user_ZZZZnotarealuser01");
console.log(`${!al ? "PASS" : "FAIL"}  never-kick list: a made-up id is not on it (${al})`);
// waiting: a made-up id waits the full budget, then "none" (timed for real)
let t = Date.now(); const w = await waitForWhopAccess("user_ZZZZnotarealuser01");
console.log(`${w.kind === "none" && w.tries === 7 ? "PASS" : "FAIL"}  made up id waits before believing "none": ${w.kind}, ${w.tries} reads, ${((Date.now() - t) / 1000).toFixed(1)} s`);
// a brand new buyer: "none" twice, then the membership shows up -> member
const realFetch = globalThis.fetch; let n = 0;
globalThis.fetch = (async (url: any, init: any) => { n++; const r = await realFetch(url, init); if (n <= 2) return new Response(JSON.stringify({ data: [] }), { status: 200 }); return r; }) as any;
const nb = await waitForWhopAccess(activeU[0], { sleep: async () => {} });
console.log(`${nb.kind === "member" && nb.tries === 3 ? "PASS" : "FAIL"}  new buyer shows up on the 3rd read: ${nb.kind} after ${nb.tries} reads`);
// forced Whop timeout: must say "error" (callers let the person in)
globalThis.fetch = ((url: any, init: any) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal.reason)))) as any;
t = Date.now(); const to = await readWhopAccess(activeU[0], { timeoutMs: 1500 });
console.log(`${to.kind === "error" ? "PASS" : "FAIL"}  forced Whop timeout: ${to.kind} (${(to as any).reason}) in ${((Date.now() - t) / 1000).toFixed(1)} s -> let in`);
const tw = await waitForWhopAccess(activeU[0], { timeoutMs: 500, sleep: async () => {} });
console.log(`${tw.kind === "error" && tw.tries === 2 ? "PASS" : "FAIL"}  Whop down during the login: asked twice, then ${tw.kind} (let in for 1 hour)`);
const dt = await dashboardAccess(endedU[0]);
console.log(`${dt === "error" ? "PASS" : "FAIL"}  dashboard re-check during a timeout: ${dt} -> let in`);
// Whop 500
globalThis.fetch = (async () => new Response("down", { status: 500 })) as any;
const e5 = await readWhopAccess(activeU[0]);
console.log(`${e5.kind === "error" ? "PASS" : "FAIL"}  Whop 500: ${e5.kind} -> let in`);
// filter ignored again: rows for strangers come back
globalThis.fetch = (async () => new Response(JSON.stringify({ data: [{ user_id: "user_someoneelse", product_id: prod, status: "active" }] }), { status: 200 })) as any;
const fi = await readWhopAccess("user_ZZZZnotarealuser01");
console.log(`${fi.kind === "untrusted" ? "PASS" : "FAIL"}  user filter ignored (stranger's active row): ${fi.kind} (not "member", not a free pass)`);
globalThis.fetch = realFetch;
// dashboard cache: member kept 10 min, ended never kept
const d1 = await dashboardAccess(activeU[0]); globalThis.fetch = (async () => new Response("down", { status: 500 })) as any;
const d2 = await dashboardAccess(activeU[0]); const d3 = await dashboardAccess(activeU[0], Date.now() + 11 * 60e3); globalThis.fetch = realFetch;
console.log(`${d1 === "member" && d2 === "member" && d3 === "error" ? "PASS" : "FAIL"}  dashboard keeps "member" 10 minutes (then asks again): ${d1}, ${d2}, after 11 min ${d3}`);
const d4 = await dashboardAccess(endedU[0]);
console.log(`${d4 === "ended" ? "PASS" : "FAIL"}  dashboard sends an ended member out: ${d4}`);

clearInterval(keepAlive);
