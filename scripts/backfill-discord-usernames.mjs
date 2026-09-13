// One-off backfill: fill discord_connections.discord_username (migration 019)
// for rows linked before the callback started saving it.
//
//   node scripts/backfill-discord-usernames.mjs --dry-run            # fetch + report, no writes
//   node scripts/backfill-discord-usernames.mjs --dry-run --limit=10
//   node scripts/backfill-discord-usernames.mjs --limit=5             # write 5 rows, eyeball, then
//   node scripts/backfill-discord-usernames.mjs                       # write every row still NULL
//   node scripts/backfill-discord-usernames.mjs --all                 # re-fetch and overwrite EVERY row
//
// Reads .env.local directly (no dotenv in this repo). Never prints env values.
// By default only rows where discord_username IS NULL are touched; --all
// refreshes every row (use it after changing which Discord field is stored).
// The upsert carries
// whop_user_id + discord_user_id + discord_username, so PostgREST updates
// just discord_username on the existing row (tier, role_id, connected_at
// stay intact; updated_at bumps via the migration 011 trigger).
// Not part of prebuild on purpose; run it by hand.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const ALL = argv.includes("--all");
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
const REQUIRED = ["DISCORD_BOT_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------
const DISCORD_HEADERS = { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, Accept: "application/json" };
const REQUEST_DELAY_MS = 250; // well under Discord's 50 req/s global limit
const MAX_429_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const str = (v) => (typeof v === "string" && v.length > 0 ? v : null);

// Returns { username } | { skip: reason } | { error: text }.
// Stores the Discord USERNAME (the unique handle), not global_name, matching
// app/api/discord/callback/route.ts.
async function fetchDiscordUsername(discordUserId) {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    const res = await fetch(`https://discord.com/api/v10/users/${discordUserId}`, { headers: DISCORD_HEADERS });
    if (res.status === 429) {
      const retryAfter = Number.parseFloat(res.headers.get("retry-after") ?? "1");
      const waitMs = Math.max(1000, (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000);
      console.warn(`  429 for ${discordUserId}, backing off ${waitMs}ms (attempt ${attempt + 1}/${MAX_429_RETRIES})`);
      await sleep(waitMs);
      continue;
    }
    if (res.status === 404) return { skip: "404 (user deleted or unknown)" };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: `HTTP ${res.status} ${text.slice(0, 120)}` };
    }
    const user = await res.json();
    const username = str(user.username);
    return username ? { username } : { skip: "no username in response" };
  }
  return { error: "gave up after repeated 429s" };
}

// ---------------------------------------------------------------------------
// Supabase (service role, same client the API routes use under the hood)
// ---------------------------------------------------------------------------
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const CHUNK = 50;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log(`backfill-discord-usernames  mode=${DRY_RUN ? "DRY RUN (no writes)" : "WRITE"}${ALL ? "  scope=ALL rows" : "  scope=NULL rows"}${LIMIT ? `  limit=${LIMIT}` : ""}`);

let query = supabase
  .from("discord_connections")
  .select("whop_user_id, discord_user_id")
  .order("connected_at", { ascending: false });
if (!ALL) query = query.is("discord_username", null);
const { data: pending, error: readError } = await query;
if (readError) {
  console.error(`discord_connections read failed: ${readError.message}`);
  process.exit(1);
}
console.log(`${ALL ? "Rows in discord_connections" : "Rows with discord_username IS NULL"}: ${pending.length}`);

let targets = pending;
if (LIMIT) {
  targets = pending.slice(0, LIMIT);
  console.log(`--limit: restricting to first ${targets.length} rows`);
}

const rows = [];
let skipped = 0;
let errors = 0;
for (const [i, row] of targets.entries()) {
  const result = await fetchDiscordUsername(row.discord_user_id);
  if (result.username) {
    rows.push({ whop_user_id: row.whop_user_id, discord_user_id: row.discord_user_id, discord_username: result.username });
    console.log(`  ${i + 1}/${targets.length}  ${row.whop_user_id}  discord=${row.discord_user_id}  -> ${result.username}`);
  } else if (result.skip) {
    skipped++;
    console.warn(`  ${i + 1}/${targets.length}  ${row.whop_user_id}  discord=${row.discord_user_id}  SKIP: ${result.skip}`);
  } else {
    errors++;
    console.error(`  ${i + 1}/${targets.length}  ${row.whop_user_id}  discord=${row.discord_user_id}  ERROR: ${result.error}`);
  }
  if (i < targets.length - 1) await sleep(REQUEST_DELAY_MS);
}

console.log(`\nResolved ${rows.length} usernames, ${skipped} skipped, ${errors} errors.`);

if (DRY_RUN) {
  console.log(`DRY RUN: would upsert ${rows.length} rows into discord_connections (discord_username). Nothing written.`);
  process.exit(0);
}

let written = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error } = await supabase
    .from("discord_connections")
    .upsert(chunk, { onConflict: "whop_user_id" });
  if (error) {
    console.error(`  chunk ${i / CHUNK + 1} failed: ${error.message} (code ${error.code ?? "?"})`);
    console.error(`  stopping. ${written} rows written before the failure.`);
    process.exit(1);
  }
  written += chunk.length;
  console.log(`  chunk ${i / CHUNK + 1}: ${chunk.length} rows ok (total ${written})`);
}
console.log(`Done. ${written} rows updated, ${skipped} skipped, ${errors} errors.`);
