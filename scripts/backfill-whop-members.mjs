// One-off backfill: every current Whop member gets a member_profiles row.
//
//   node scripts/backfill-whop-members.mjs --dry-run          # fetch + report, no writes
//   node scripts/backfill-whop-members.mjs --dry-run --limit=20
//   node scripts/backfill-whop-members.mjs --limit=5           # write 5 rows, eyeball, then
//   node scripts/backfill-whop-members.mjs                     # write everything
//
// Reads .env.local directly (no dotenv in this repo). Never prints env values.
// Writes ONLY whop_user_id + whop_joined_at (migration 016) + whop_plan_id +
// whop_tier (migration 018) + whop_display_name + whop_username (migration
// 019): PostgREST upsert sets just the columns provided, so existing rows keep
// display_name, phone, bio, photo_url, intake_* intact.
// Not part of prebuild on purpose; run it by hand.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Plan id -> tier. Same map as lib/whop-member.ts and
// app/api/discord/callback/route.ts (not importable from an .mjs script, so
// re-declared here). Unknown plan ids yield null so the row is still written.
const PLAN_TIERS = {
  plan_2NqC2WJzV87QY: "Base",
  plan_J8vFpCWME75W3: "Pro",
  plan_SIYHeHyFp1dbR: "Pro",   // legacy $75/mo
  plan_SGscR3JhdTtKh: "Base",  // legacy $1 entry
  plan_9nyRNbuhQF0pk: "Pro",   // Pro 3-month
  plan_mjpuBNS3KJqmw: "Pro",   // Ultra ($249, mapped to Pro internally)
  plan_tfYMBwmuOwuB0: "Pro",   // Pro 6-month
};

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : null;
if (limitArg && (!Number.isInteger(LIMIT) || LIMIT <= 0)) {
  console.error("--limit must be a positive integer");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Env (.env.local, values never logged)
// ---------------------------------------------------------------------------
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // No .env.local: fall through to process.env and let the check below speak.
}
const REQUIRED = ["WHOP_API_KEY", "WHOP_COMPANY_ID", "WHOP_PRODUCT_ID", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Whop
// ---------------------------------------------------------------------------
// Scope to the app's product, like every membership lookup in app/ does.
// The company also has a second "Real Venture" product and a "Deposit"
// product whose members the dashboard cannot tier.
const WHOP_PRODUCT_ID = env.WHOP_PRODUCT_ID;

// Only backfill members with a live/paying relationship.
// Skip canceled, expired, past_due: they are not "current members" for admin analytics.
const ACTIVE_STATUSES = new Set(["active", "trialing", "paid", "completed"]);

// Same header shape as app/api/whop/whop-membership.ts whopAuthHeaders()
// (not importable from an .mjs script, so re-declared here).
const WHOP_HEADERS = {
  Authorization: `Bearer ${env.WHOP_API_KEY}`,
  Accept: "application/json",
};
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 250;
const MAX_PAGES = 100; // 803 rows today = 9 pages; hard stop against a runaway cursor

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAllMemberships() {
  const all = [];
  let after = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ company_id: env.WHOP_COMPANY_ID, per: String(PAGE_SIZE) });
    params.set("product_ids", WHOP_PRODUCT_ID);
    if (after) params.set("after", after);
    const res = await fetch(`https://api.whop.com/api/v1/memberships?${params}`, { headers: WHOP_HEADERS });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Whop memberships page ${page}: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const body = await res.json();
    const rows = Array.isArray(body?.data) ? body.data : [];
    all.push(...rows);
    const info = body?.page_info ?? {};
    process.stdout.write(`  page ${page}: ${rows.length} rows (running total ${all.length})\n`);
    if (!info.has_next_page || !info.end_cursor) break;
    after = info.end_cursor;
    await sleep(PAGE_DELAY_MS);
  }
  return all;
}

// Lower rank wins. Paying relationships first, then one-time purchases.
function statusRank(status) {
  switch (status) {
    case "active": return 0;
    case "trialing": return 1;
    case "paid": return 2;
    case "completed": return 3;
    default: return 9;
  }
}

function collapseByUser(memberships) {
  let filteredOut = 0;
  const byUser = new Map();
  for (const m of memberships) {
    const userId = m.user?.id;
    if (!userId) continue;

    if (!ACTIVE_STATUSES.has(m.status)) {
      filteredOut++;
      continue;
    }

    const prev = byUser.get(userId);
    if (!prev) { byUser.set(userId, m); continue; }
    const cmpStatus = statusRank(m.status) - statusRank(prev.status);
    if (cmpStatus < 0) { byUser.set(userId, m); continue; }
    if (cmpStatus === 0) {
      const a = new Date(m.joined_at ?? m.created_at ?? 0).getTime();
      const b = new Date(prev.joined_at ?? prev.created_at ?? 0).getTime();
      if (a > b) byUser.set(userId, m);
    }
  }
  return { byUser, filteredOut };
}

// ---------------------------------------------------------------------------
// Supabase (service role, same client the API routes use under the hood)
// ---------------------------------------------------------------------------
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const CHUNK = 100;

async function existingProfileIds() {
  const ids = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("member_profiles")
      .select("whop_user_id")
      .range(from, from + 999);
    if (error) throw new Error(`member_profiles read failed: ${error.message}`);
    for (const r of data ?? []) ids.add(r.whop_user_id);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log(`backfill-whop-members  mode=${DRY_RUN ? "DRY RUN (no writes)" : "WRITE"}${LIMIT ? `  limit=${LIMIT}` : ""}`);
console.log("Fetching Whop memberships...");
const memberships = await fetchAllMemberships();
console.log(`Fetched ${memberships.length} memberships`);

const { byUser, filteredOut } = collapseByUser(memberships);
console.log(`Filtered out ${filteredOut} canceled/expired/past_due memberships`);
console.log(`Collapsed to ${byUser.size} unique active users`);

const statusCounts = {};
for (const m of byUser.values()) statusCounts[m.status] = (statusCounts[m.status] ?? 0) + 1;
console.log("Winning membership status per user:", JSON.stringify(statusCounts));

const existing = await existingProfileIds();
const str = (v) => (typeof v === "string" && v.length > 0 ? v : null);
let rows = [...byUser.entries()].map(([whop_user_id, m]) => {
  const planId = m.plan?.id ?? null;
  return {
    whop_user_id,
    whop_joined_at: m.joined_at ?? m.created_at ?? null,
    whop_plan_id: planId,
    whop_tier: planId ? (PLAN_TIERS[planId] ?? null) : null,
    // Embedded Whop user record on the membership row (migration 019).
    whop_display_name: str(m.user?.name),
    whop_username: str(m.user?.username),
  };
});
const tierCounts = {};
for (const r of rows) tierCounts[r.whop_tier ?? "unmapped"] = (tierCounts[r.whop_tier ?? "unmapped"] ?? 0) + 1;
console.log("Derived tier per user:", JSON.stringify(tierCounts));
const alreadyThere = rows.filter((r) => existing.has(r.whop_user_id)).length;
console.log(`member_profiles today: ${existing.size} rows. Of the ${rows.length} to upsert: ${alreadyThere} exist (no-op update), ${rows.length - alreadyThere} would be new.`);

if (LIMIT) {
  rows = rows.slice(0, LIMIT);
  console.log(`--limit: restricting to first ${rows.length} rows`);
}

const PREVIEW = 10;
console.log(`\nFirst ${Math.min(PREVIEW, rows.length)} rows:`);
for (const r of rows.slice(0, PREVIEW)) {
  const m = byUser.get(r.whop_user_id);
  console.log(`  ${r.whop_user_id}  ${existing.has(r.whop_user_id) ? "exists" : "NEW   "}  status=${m.status}  plan=${r.whop_plan_id ?? "?"}  tier=${r.whop_tier ?? "-"}  joined=${(r.whop_joined_at ?? "").slice(0, 10)}  name=${r.whop_display_name ?? "-"}  username=${r.whop_username ?? "-"}`);
}

if (DRY_RUN) {
  console.log(`\nDRY RUN: would upsert ${rows.length} rows into member_profiles (whop_user_id + whop_joined_at + whop_plan_id + whop_tier + whop_display_name + whop_username). Nothing written.`);
  process.exit(0);
}

console.log(`\nWriting ${rows.length} rows in chunks of ${CHUNK}...`);
let written = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error } = await supabase
    .from("member_profiles")
    .upsert(chunk, { onConflict: "whop_user_id" });
  if (error) {
    console.error(`  chunk ${i / CHUNK + 1} failed: ${error.message} (code ${error.code ?? "?"})`);
    console.error(`  stopping. ${written} rows written before the failure.`);
    process.exit(1);
  }
  written += chunk.length;
  console.log(`  chunk ${i / CHUNK + 1}: ${chunk.length} rows ok (total ${written})`);
}
console.log(`Done. ${written} rows upserted.`);
