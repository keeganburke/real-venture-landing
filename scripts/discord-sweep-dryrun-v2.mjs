// Discord churn sweep v2: DRY RUN ONLY.
//
// Like scripts/discord-sweep-dryrun.mjs, but uses TWO Whop exports made
// today: FULL (all members) and GONE (Whop filtered to Left + Churned). A
// guild member is only a KICK when a linked Whop user is in GONE and no
// linked user holds a live membership. It never kicks, bans, DMs, or
// changes roles: every Discord call is a GET and the helper refuses
// anything else. Supabase is select only.
//
// Run:  node --env-file=.env.local scripts/discord-sweep-dryrun-v2.mjs
//
// Output: ~/Desktop/discord-sweep/dryrun-v2-<YYYY-MM-DD-HHmm>.csv (outside the repo)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DISCORD_API = "https://discord.com/api/v10";

// Permission bits that make a member EXEMPT.
const EXEMPT_PERMS = {
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 28n,
};

const PAID_ROLE_NAMES = new Set(["Base Member", "Pro Member", "Ultra Member"]);
const HIGH_SPEND_USD = 250;
const GONE_MAX_RATIO = 0.9;

const REQUIRED_COLUMNS = [
  "User ID",
  "Name",
  "Email",
  "Username",
  "Discord ID",
  "Discord username",
  "Membership IDs",
  "Platform spend (USD)",
];

function stop(message) {
  console.error(`STOP: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Whop exports (parser and loader reused from v1, plus Name and spend)
// ---------------------------------------------------------------------------

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function findTodayExports() {
  const dir = path.join(os.homedir(), "Downloads");
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => /^exprt_.*\.csv$/.test(n));
  } catch (err) {
    stop(`cannot read ${dir}: ${err.message}`);
  }
  const now = new Date();
  return names
    .map((n) => ({ file: path.join(dir, n), mtime: fs.statSync(path.join(dir, n)).mtime }))
    .filter((f) => sameLocalDay(f.mtime, now))
    .sort((a, b) => b.mtime - a.mtime);
}

// Minimal RFC 4180 parser: quoted fields, doubled quotes, commas and newlines
// inside quotes, CRLF or LF line endings.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function parseSpend(value) {
  const n = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function loadExport(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  if (rows.length === 0) stop(`export is empty: ${path.basename(file)}`);
  const header = rows[0].map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) stop(`${path.basename(file)} is missing column(s): ${missing.join(", ")}`);
  const idx = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, header.indexOf(c)]));
  const cell = (r, name) => (r[idx[name]] ?? "").trim();
  return rows.slice(1).map((r) => ({
    userId: cell(r, "User ID"),
    name: cell(r, "Name"),
    email: cell(r, "Email"),
    username: cell(r, "Username"),
    discordId: cell(r, "Discord ID"),
    discordUsername: cell(r, "Discord username"),
    live: cell(r, "Membership IDs") !== "",
    spendUsd: parseSpend(cell(r, "Platform spend (USD)")),
  }));
}

// ---------------------------------------------------------------------------
// Supabase (select only)
// ---------------------------------------------------------------------------

async function loadConnections() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) stop("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("discord_connections")
      .select("discord_user_id, whop_user_id")
      .order("whop_user_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) stop(`discord_connections select failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Discord (GET only)
// ---------------------------------------------------------------------------

async function discordGet(pathname) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) stop("DISCORD_BOT_TOKEN is not set");
  for (let attempt = 0; attempt < 5; attempt++) {
    // method is fixed: this script must never write to Discord.
    const res = await fetch(`${DISCORD_API}${pathname}`, {
      method: "GET",
      headers: { Authorization: `Bot ${token}` },
    });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const waitMs = Math.ceil((Number(body.retry_after) || 1) * 1000) + 250;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  stop(`Discord kept rate limiting GET ${pathname}`);
}

async function loadGuild(guildId) {
  const res = await discordGet(`/guilds/${guildId}`);
  if (!res.ok) stop(`GET /guilds/{guildId} returned ${res.status}`);
  return res.json();
}

async function loadRoles(guildId) {
  const res = await discordGet(`/guilds/${guildId}/roles`);
  if (!res.ok) stop(`GET /guilds/{guildId}/roles returned ${res.status}`);
  return res.json();
}

async function loadMembers(guildId) {
  const members = [];
  let after = "0";
  for (;;) {
    const res = await discordGet(`/guilds/${guildId}/members?limit=1000&after=${after}`);
    if (res.status === 403) stop("Server Members Intent is off for this bot.");
    if (!res.ok) stop(`GET /guilds/{guildId}/members returned ${res.status}`);
    const page = await res.json();
    members.push(...page);
    if (page.length < 1000) break;
    after = page[page.length - 1].user.id;
  }
  return members;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// Lowercase, letters and digits only; empty when shorter than 6.
function normKey(value) {
  const k = String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return k.length >= 6 ? k : "";
}

function emailLocal(email) {
  const at = String(email ?? "").indexOf("@");
  return at > 0 ? email.slice(0, at) : "";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Discord churn sweep v2: DRY RUN. No kicks, bans, DMs or role changes. Discord calls are GET only.\n");

  // 1. Two exports made today
  const today = findTodayExports();
  if (today.length < 2) {
    stop(
      `need two Whop exports modified today (FULL and GONE); found ${today.length} ` +
        `matching ~/Downloads/exprt_*.csv with today's date. Export both from Whop and run again.`
    );
  }
  const candidates = today.slice(0, 2).map((f) => ({ ...f, rows: loadExport(f.file) }));
  candidates.sort((a, b) => b.rows.length - a.rows.length);
  const [full, gone] = candidates;
  for (const [label, f] of [["FULL", full], ["GONE", gone]]) {
    console.log(`${label}: ${path.basename(f.file)} | modified ${f.mtime.toLocaleString()} | rows ${f.rows.length}`);
  }
  const fullByUserId = new Map(full.rows.filter((r) => r.userId).map((r) => [r.userId, r]));
  const missingFromFull = gone.rows.filter((r) => r.userId && !fullByUserId.has(r.userId));
  if (missingFromFull.length > 0) {
    stop(`${missingFromFull.length} "User ID"(s) in GONE are missing from FULL (first: ${missingFromFull[0].userId}). Re-export both from the same moment.`);
  }
  if (gone.rows.length > GONE_MAX_RATIO * full.rows.length) {
    stop(`GONE has ${gone.rows.length} rows, more than 90% of FULL's ${full.rows.length}: it was not filtered to Left + Churned.`);
  }
  const goneIds = new Set(gone.rows.map((r) => r.userId).filter(Boolean));
  const liveRows = full.rows.filter((r) => r.live);
  console.log(`LIVE users in FULL: ${liveRows.length} | GONE user ids: ${goneIds.size}`);

  // 2. discord_connections
  const connections = await loadConnections();
  console.log(`discord_connections rows: ${connections.length}`);

  // 3. Discord
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) stop("DISCORD_GUILD_ID is not set");
  const guild = await loadGuild(guildId);
  const roles = await loadRoles(guildId);
  const members = await loadMembers(guildId);
  console.log(`Guild: ${guild.name} | roles ${roles.length} | members fetched ${members.length}\n`);

  // Indexes
  const fullByDiscordId = new Map();
  for (const r of full.rows) {
    if (!r.discordId) continue;
    if (!fullByDiscordId.has(r.discordId)) fullByDiscordId.set(r.discordId, []);
    fullByDiscordId.get(r.discordId).push(r);
  }
  const connByDiscordId = new Map();
  for (const c of connections) {
    if (!c.discord_user_id) continue;
    if (!connByDiscordId.has(c.discord_user_id)) connByDiscordId.set(c.discord_user_id, []);
    connByDiscordId.get(c.discord_user_id).push(c.whop_user_id);
  }
  const liveNameKeys = new Set(liveRows.map((r) => normKey(r.name)).filter(Boolean));
  const liveEmailKeys = new Set(liveRows.map((r) => normKey(emailLocal(r.email))).filter(Boolean));
  const liveDiscordNames = new Set(liveRows.map((r) => r.discordUsername.toLowerCase()).filter(Boolean));
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const everyoneRole = roleById.get(guildId); // applies to every member
  const exemptPermsOf = (role) => {
    if (!role) return [];
    const bits = BigInt(role.permissions);
    return Object.entries(EXEMPT_PERMS)
      .filter(([, bit]) => (bits & bit) !== 0n)
      .map(([name]) => name);
  };

  // Verdicts
  const out = [];
  const linkedGoneIds = new Set();
  for (const m of members) {
    const id = m.user.id;
    const memberRoles = m.roles.map((rid) => roleById.get(rid)).filter(Boolean);
    const roleNames = memberRoles.map((r) => r.name).sort((a, b) => a.localeCompare(b));
    const hasPaidRole = roleNames.some((n) => PAID_ROLE_NAMES.has(n));

    const linked = new Map(); // whop user id -> { row, via:Set }
    for (const row of fullByDiscordId.get(id) ?? []) {
      if (!linked.has(row.userId)) linked.set(row.userId, { row, via: new Set() });
      linked.get(row.userId).via.add("export_discord_id");
    }
    for (const whopUserId of connByDiscordId.get(id) ?? []) {
      const row = fullByUserId.get(whopUserId);
      if (!row) continue; // connection to a user not in FULL does not count as a link
      if (!linked.has(row.userId)) linked.set(row.userId, { row, via: new Set() });
      linked.get(row.userId).via.add("discord_connections");
    }
    const links = [...linked.values()];
    const anyLive = links.some((l) => l.row.live);
    const inGone = links.filter((l) => goneIds.has(l.row.userId));
    for (const l of inGone) linkedGoneIds.add(l.row.userId);

    const exemptRoleHits = [...memberRoles, everyoneRole]
      .filter(Boolean)
      .map((r) => ({ name: r.name, perms: exemptPermsOf(r) }))
      .filter((r) => r.perms.length > 0);

    let verdict;
    let reason;
    if (m.user.bot) {
      verdict = "EXEMPT";
      reason = "bot";
    } else if (id === guild.owner_id) {
      verdict = "EXEMPT";
      reason = "guild owner";
    } else if (exemptRoleHits.length > 0) {
      verdict = "EXEMPT";
      reason = "role with " + exemptRoleHits.map((r) => `${r.perms.join("+")} (${r.name})`).join("; ");
    } else if (anyLive) {
      verdict = "KEEP";
      reason = inGone.length > 0
        ? "conflict: listed left/churned but has a live membership"
        : "linked Whop user has a live membership";
    } else if (inGone.length > 0) {
      verdict = "KICK";
      reason = `linked to ${inGone.length} left/churned Whop user(s), none with a live membership`;
    } else if (links.length > 0) {
      verdict = "NOT_LABELED";
      reason = `linked to ${links.length} Whop user(s): none live, none in the left/churned export`;
    } else {
      verdict = "UNKNOWN";
      reason = "no linked Whop user";
    }

    // Flags: KICK rows only, verdict unchanged.
    const flags = [];
    if (verdict === "KICK") {
      if (links.some((l) => l.row.spendUsd > HIGH_SPEND_USD)) flags.push("high_spend");
      if (links.some((l) => { const k = normKey(l.row.name); return k && liveNameKeys.has(k); })) flags.push("name_match");
      if (links.some((l) => { const k = normKey(emailLocal(l.row.email)); return k && liveEmailKeys.has(k); })) flags.push("email_match");
      const du = (m.user.username ?? "").toLowerCase();
      if (du && liveDiscordNames.has(du)) flags.push("discord_name_match");
    }

    out.push({
      verdict,
      reason,
      flags: flags.join("|"),
      discord_id: id,
      discord_username: m.user.username ?? "",
      display_name: m.nick ?? m.user.global_name ?? "",
      joined_at: m.joined_at ?? "",
      role_names: roleNames.join(" | "),
      has_paid_role: hasPaidRole ? "yes" : "no",
      whop_user_id: links.map((l) => l.row.userId).join(" | "),
      whop_email: links.map((l) => l.row.email).join(" | "),
      whop_spend_usd: links.map((l) => l.row.spendUsd.toFixed(2)).join(" | "),
      matched_via: links.map((l) => [...l.via].sort().join("+")).join(" | "),
      _flags: flags,
    });
  }

  // CSV
  const columns = [
    "verdict", "reason", "flags", "discord_id", "discord_username", "display_name", "joined_at",
    "role_names", "has_paid_role", "whop_user_id", "whop_email", "whop_spend_usd", "matched_via",
  ];
  const order = { KICK: 0, NOT_LABELED: 1, UNKNOWN: 2, KEEP: 3, EXEMPT: 4 };
  out.sort((a, b) => order[a.verdict] - order[b.verdict] || a.discord_username.localeCompare(b.discord_username));
  const now = new Date();
  const outDir = path.join(os.homedir(), "Desktop", "discord-sweep");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `dryrun-v2-${stamp(now)}.csv`);
  const lines = [columns.join(",")].concat(out.map((r) => columns.map((c) => csvCell(r[c])).join(",")));
  fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");

  // Summary (counts only, no personal data)
  const count = (pred) => out.filter(pred).length;
  console.log("SUMMARY");
  console.log(`  GONE rows: ${gone.rows.length} | of those linked to someone in the server: ${linkedGoneIds.size}`);
  console.log(`  total members: ${out.length}`);
  for (const v of ["EXEMPT", "KEEP", "KICK", "NOT_LABELED", "UNKNOWN"]) {
    console.log(`  ${v.padEnd(12)} ${count((r) => r.verdict === v)}`);
  }
  for (const v of ["KICK", "NOT_LABELED"]) {
    console.log(`  ${v}: with paid role ${count((r) => r.verdict === v && r.has_paid_role === "yes")}, without ${count((r) => r.verdict === v && r.has_paid_role === "no")}`);
  }
  console.log(`  KICK rows with any flag: ${count((r) => r.verdict === "KICK" && r._flags.length > 0)}`);
  for (const f of ["high_spend", "name_match", "email_match", "discord_name_match"]) {
    console.log(`    ${f.padEnd(20)} ${count((r) => r.verdict === "KICK" && r._flags.includes(f))}`);
  }
  console.log(`\nWrote ${outFile}`);
  console.log("DRY RUN complete. Nothing was changed in Discord, Whop or Supabase.");
}

main().catch((err) => {
  console.error("STOP: unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
