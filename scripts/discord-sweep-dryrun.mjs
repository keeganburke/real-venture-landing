// Discord churn sweep: DRY RUN ONLY.
//
// Compares the Discord guild member list against the newest Whop member
// export and the discord_connections table, and writes a CSV saying who
// WOULD be kept, kicked, or is unknown. It never kicks, bans, DMs, or
// changes roles: every Discord call in this file is a GET, and the request
// helper refuses anything else.
//
// Run:  node --env-file=.env.local scripts/discord-sweep-dryrun.mjs
//
// Inputs
//   1. ~/Downloads/exprt_*.csv   newest Whop export; must be modified today
//   2. Supabase discord_connections (select only)
//   3. Discord guild, roles and members (GET only)
// Output
//   ~/Desktop/discord-sweep/dryrun-<YYYY-MM-DD-HHmm>.csv  (outside the repo)

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

const REQUIRED_COLUMNS = ["User ID", "Email", "Username", "Discord ID", "Discord username", "Membership IDs"];

function stop(message) {
  console.error(`STOP: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Whop export
// ---------------------------------------------------------------------------

function findNewestExport() {
  const dir = path.join(os.homedir(), "Downloads");
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => /^exprt_.*\.csv$/.test(n));
  } catch (err) {
    stop(`cannot read ${dir}: ${err.message}`);
  }
  if (names.length === 0) stop(`no file matching ${dir}/exprt_*.csv`);
  const files = names
    .map((n) => ({ file: path.join(dir, n), mtime: fs.statSync(path.join(dir, n)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0];
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

function loadExport(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  if (rows.length === 0) stop("export is empty");
  const header = rows[0].map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) stop(`export is missing column(s): ${missing.join(", ")}`);
  const idx = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, header.indexOf(c)]));
  const cell = (r, name) => (r[idx[name]] ?? "").trim();
  return rows.slice(1).map((r) => ({
    userId: cell(r, "User ID"),
    email: cell(r, "Email"),
    username: cell(r, "Username"),
    discordId: cell(r, "Discord ID"),
    discordUsername: cell(r, "Discord username"),
    live: cell(r, "Membership IDs") !== "",
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
// Output helpers
// ---------------------------------------------------------------------------

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) for (const k of keyFn(it)) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Discord churn sweep: DRY RUN. No kicks, bans, DMs or role changes. Discord calls are GET only.\n");

  // 1. Whop export
  const newest = findNewestExport();
  const now = new Date();
  console.log(`Whop export: ${path.basename(newest.file)}`);
  console.log(`Modified:    ${newest.mtime.toLocaleString()}`);
  if (!sameLocalDay(newest.mtime, now)) {
    stop(
      `the newest export was not modified today (${now.toLocaleDateString()}). ` +
        "Download a fresh export from Whop and run again."
    );
  }
  const exportRows = loadExport(newest.file);
  const liveCount = exportRows.filter((r) => r.live).length;
  console.log(`Export rows: ${exportRows.length} (LIVE ${liveCount}, FORMER ${exportRows.length - liveCount})`);

  // 2. Guild id: same env var the app uses (app/api/discord/callback/route.ts).
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) stop("DISCORD_GUILD_ID is not set");

  // 3. discord_connections
  const connections = await loadConnections();
  console.log(`discord_connections rows: ${connections.length}`);

  // 4. Discord
  const guild = await loadGuild(guildId);
  const roles = await loadRoles(guildId);
  const members = await loadMembers(guildId);
  console.log(`Guild: ${guild.name} | roles ${roles.length} | members fetched ${members.length}\n`);

  // Indexes
  const exportByUserId = new Map();
  const exportByDiscordId = new Map();
  for (const r of exportRows) {
    if (r.userId) exportByUserId.set(r.userId, r);
    if (r.discordId) {
      if (!exportByDiscordId.has(r.discordId)) exportByDiscordId.set(r.discordId, []);
      exportByDiscordId.get(r.discordId).push(r);
    }
  }
  const connByDiscordId = new Map();
  for (const c of connections) {
    if (!c.discord_user_id) continue;
    if (!connByDiscordId.has(c.discord_user_id)) connByDiscordId.set(c.discord_user_id, []);
    connByDiscordId.get(c.discord_user_id).push(c.whop_user_id);
  }
  const roleById = new Map(roles.map((r) => [r.id, r]));
  // The @everyone role has the guild's id and applies to every member.
  const everyoneRole = roleById.get(guildId);

  const exemptPermsOf = (role) => {
    if (!role) return [];
    const bits = BigInt(role.permissions);
    return Object.entries(EXEMPT_PERMS)
      .filter(([, bit]) => (bits & bit) !== 0n)
      .map(([name]) => name);
  };

  // Verdicts
  const out = [];
  for (const m of members) {
    const id = m.user.id;
    const memberRoles = m.roles.map((rid) => roleById.get(rid)).filter(Boolean);
    const roleNames = memberRoles.map((r) => r.name).sort((a, b) => a.localeCompare(b));

    // Linked Whop users: a) export Discord ID, b) discord_connections joined to the export.
    const linked = new Map(); // whop user id -> { row, via:Set }
    for (const row of exportByDiscordId.get(id) ?? []) {
      if (!linked.has(row.userId)) linked.set(row.userId, { row, via: new Set() });
      linked.get(row.userId).via.add("export_discord_id");
    }
    const unmatchedConnections = [];
    for (const whopUserId of connByDiscordId.get(id) ?? []) {
      const row = exportByUserId.get(whopUserId);
      if (!row) {
        unmatchedConnections.push(whopUserId);
        continue;
      }
      if (!linked.has(row.userId)) linked.set(row.userId, { row, via: new Set() });
      linked.get(row.userId).via.add("discord_connections");
    }
    const links = [...linked.values()];

    let verdict;
    let reason;
    const exemptRoleHits = [...memberRoles, everyoneRole]
      .filter(Boolean)
      .map((r) => ({ name: r.name, perms: exemptPermsOf(r) }))
      .filter((r) => r.perms.length > 0);

    if (m.user.bot) {
      verdict = "EXEMPT";
      reason = "bot";
    } else if (id === guild.owner_id) {
      verdict = "EXEMPT";
      reason = "guild owner";
    } else if (exemptRoleHits.length > 0) {
      verdict = "EXEMPT";
      reason = "role with " + exemptRoleHits.map((r) => `${r.perms.join("+")} (${r.name})`).join("; ");
    } else if (links.some((l) => l.row.live)) {
      verdict = "KEEP";
      reason = "linked Whop user has a live membership";
    } else if (links.length > 0) {
      verdict = "KICK";
      reason = `linked to ${links.length} Whop user(s), none with a live membership`;
    } else {
      verdict = "UNKNOWN";
      reason =
        unmatchedConnections.length > 0
          ? "discord_connections row exists but its Whop user is not in the export"
          : "no linked Whop user";
    }

    out.push({
      verdict,
      reason,
      discord_id: id,
      discord_username: m.user.username ?? "",
      display_name: m.nick ?? m.user.global_name ?? "",
      joined_at: m.joined_at ?? "",
      role_names: roleNames.join(" | "),
      whop_user_id: links.length > 0 ? links.map((l) => l.row.userId).join(" | ") : unmatchedConnections.join(" | "),
      whop_email: links.map((l) => l.row.email).join(" | "),
      matched_via: links.map((l) => [...l.via].sort().join("+")).join(" | "),
      _roleNames: roleNames,
    });
  }

  // CSV
  const columns = [
    "verdict",
    "reason",
    "discord_id",
    "discord_username",
    "display_name",
    "joined_at",
    "role_names",
    "whop_user_id",
    "whop_email",
    "matched_via",
  ];
  const order = { KICK: 0, UNKNOWN: 1, KEEP: 2, EXEMPT: 3 };
  out.sort((a, b) => order[a.verdict] - order[b.verdict] || a.discord_username.localeCompare(b.discord_username));
  const outDir = path.join(os.homedir(), "Desktop", "discord-sweep");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `dryrun-${stamp(now)}.csv`);
  const lines = [columns.join(",")].concat(out.map((r) => columns.map((c) => csvCell(r[c])).join(",")));
  fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");

  // Summary (counts only, no personal data)
  console.log("SUMMARY");
  console.log(`  total members: ${out.length}`);
  for (const v of ["EXEMPT", "KEEP", "KICK", "UNKNOWN"]) {
    console.log(`  ${v.padEnd(8)} ${out.filter((r) => r.verdict === v).length}`);
  }
  for (const v of ["KICK", "UNKNOWN"]) {
    const subset = out.filter((r) => r.verdict === v);
    console.log(`\n  ${v} by role name (a member with several roles counts once per role):`);
    const counts = countBy(subset, (r) => (r._roleNames.length > 0 ? r._roleNames : ["(no roles)"]));
    if (counts.length === 0) console.log("    (none)");
    for (const [name, n] of counts) console.log(`    ${String(n).padStart(4)}  ${name}`);
  }
  console.log(`\nWrote ${outFile}`);
  console.log("DRY RUN complete. Nothing was changed in Discord, Whop or Supabase.");
}

main().catch((err) => {
  console.error("STOP: unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
