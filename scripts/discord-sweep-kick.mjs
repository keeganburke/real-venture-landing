// Discord churn sweep: KICK script with a test limit.
//
// Reads the newest dry-run v2 CSV (~/Desktop/discord-sweep/dryrun-v2-*.csv),
// takes the KICK rows that carry no flags, re-checks each member live against
// Discord, and either previews or performs the removal.
//
//   node --env-file=.env.local scripts/discord-sweep-kick.mjs              PREVIEW (no removals)
//   node --env-file=.env.local scripts/discord-sweep-kick.mjs --limit 5    PREVIEW, first 5 only
//   node --env-file=.env.local scripts/discord-sweep-kick.mjs --confirm    real removals
//   node --env-file=.env.local scripts/discord-sweep-kick.mjs --confirm --limit 5
//
// Without --confirm nothing is removed: the only write call lives in
// kickMember() and is reached solely from the --confirm branch.
// Parser, Discord helper pattern, 429 handling and env usage follow
// scripts/discord-sweep-dryrun-v2.mjs.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DISCORD_API = "https://discord.com/api/v10";
const SWEEP_DIR = path.join(os.homedir(), "Desktop", "discord-sweep");
const MAX_INPUT_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_ROWS = 230;
const PAUSE_MS = 1100;
const MAX_CONSECUTIVE_FAILURES = 5;
const AUDIT_REASON = "Membership ended (sweep 2026-10-06)";

// Roles a member may hold and still be removable. Anything else protects them.
const REMOVABLE_ROLE_NAMES = new Set(["Base Member", "Pro Member", "New Member"]);

// Permission bits that protect a member.
const PROTECT_PERMS = {
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 28n,
};

const REQUIRED_COLUMNS = ["verdict", "flags", "discord_id", "discord_username", "role_names", "has_paid_role"];

function stop(message) {
  console.error(`STOP: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  let confirm = false;
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") {
      confirm = true;
    } else if (a === "--limit") {
      const raw = argv[i + 1];
      if (!/^[1-9]\d*$/.test(raw ?? "")) stop("--limit needs a positive integer");
      limit = Number(raw);
      i++;
    } else if (a.startsWith("--limit=")) {
      const raw = a.slice("--limit=".length);
      if (!/^[1-9]\d*$/.test(raw)) stop("--limit needs a positive integer");
      limit = Number(raw);
    } else {
      stop(`unknown argument: ${a}`);
    }
  }
  return { confirm, limit };
}

// ---------------------------------------------------------------------------
// CSV (parser reused from the dry-run scripts)
// ---------------------------------------------------------------------------

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

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function readCsvObjects(file, required) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  if (rows.length === 0) stop(`${path.basename(file)} is empty`);
  const header = rows[0].map((h) => h.trim());
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length > 0) stop(`${path.basename(file)} is missing column(s): ${missing.join(", ")}`);
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ---------------------------------------------------------------------------
// Input list
// ---------------------------------------------------------------------------

function findNewestDryRun() {
  let names;
  try {
    names = fs.readdirSync(SWEEP_DIR).filter((n) => /^dryrun-v2-.*\.csv$/.test(n));
  } catch (err) {
    stop(`cannot read ${SWEEP_DIR}: ${err.message}`);
  }
  if (names.length === 0) stop(`no file matching ${SWEEP_DIR}/dryrun-v2-*.csv`);
  return names
    .map((n) => ({ file: path.join(SWEEP_DIR, n), mtime: fs.statSync(path.join(SWEEP_DIR, n)).mtime }))
    .sort((a, b) => b.mtime - a.mtime)[0];
}

function buildList() {
  const newest = findNewestDryRun();
  console.log(`Input: ${path.basename(newest.file)}`);
  console.log(`Modified: ${newest.mtime.toLocaleString()}`);
  const ageMs = Date.now() - newest.mtime.getTime();
  if (ageMs > MAX_INPUT_AGE_MS) {
    stop(`that dry run is ${(ageMs / 3600000).toFixed(1)} hours old (limit 12). Run scripts/discord-sweep-dryrun-v2.mjs again first.`);
  }

  const all = readCsvObjects(newest.file, REQUIRED_COLUMNS);
  let rows = all.filter((r) => r.verdict === "KICK" && r.flags === "");
  console.log(`Rows in dry run: ${all.length} | KICK with no flags: ${rows.length}`);

  const excludeFile = path.join(SWEEP_DIR, "kick-exclude.csv");
  if (fs.existsSync(excludeFile)) {
    const excluded = new Set(readCsvObjects(excludeFile, ["discord_id"]).map((r) => r.discord_id).filter(Boolean));
    const before = rows.length;
    rows = rows.filter((r) => !excluded.has(r.discord_id));
    console.log(`kick-exclude.csv: ${excluded.size} id(s) listed, ${before - rows.length} row(s) dropped`);
  } else {
    console.log("kick-exclude.csv: not present, 0 rows dropped");
  }

  if (rows.length === 0) stop("zero rows to process");
  if (rows.length > MAX_ROWS) stop(`${rows.length} rows is more than the ${MAX_ROWS} row cap`);
  const bad = rows.filter((r) => !/^\d{17,20}$/.test(r.discord_id));
  if (bad.length > 0) stop(`${bad.length} discord_id value(s) are not 17 to 20 digits (first: "${bad[0].discord_id}")`);
  const seen = new Set();
  const dupes = rows.filter((r) => (seen.has(r.discord_id) ? true : (seen.add(r.discord_id), false)));
  if (dupes.length > 0) stop(`duplicate discord_id(s): ${dupes.map((r) => r.discord_id).join(", ")}`);

  // Stable: "no" paid role first, then "yes"; file order inside each group.
  const noPaid = rows.filter((r) => r.has_paid_role !== "yes");
  const paid = rows.filter((r) => r.has_paid_role === "yes");
  return [...noPaid, ...paid];
}

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------

function botHeaders(extra = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) stop("DISCORD_BOT_TOKEN is not set");
  return { Authorization: `Bot ${token}`, ...extra };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET with the dry-run scripts' 429 handling (wait retry_after, retry once).
async function discordGet(pathname) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${DISCORD_API}${pathname}`, { method: "GET", headers: botHeaders() });
    if (res.status === 429 && attempt === 0) {
      const body = await res.json().catch(() => ({}));
      await sleep(Math.ceil((Number(body.retry_after) || 1) * 1000) + 250);
      continue;
    }
    return res;
  }
}

// The ONLY write call in this file. Reached from the --confirm branch only.
async function kickMember(guildId, discordId) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}`, {
      method: "DELETE",
      headers: botHeaders({ "X-Audit-Log-Reason": encodeURIComponent(AUDIT_REASON) }),
    });
    if (res.status === 429 && attempt === 0) {
      const body = await res.json().catch(() => ({}));
      await sleep(Math.ceil((Number(body.retry_after) || 1) * 1000) + 250);
      continue;
    }
    return res;
  }
}

async function loadJson(pathname, label) {
  const res = await discordGet(pathname);
  if (!res || !res.ok) stop(`GET ${label} returned ${res ? res.status : "no response"}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { confirm, limit } = parseArgs(process.argv.slice(2));
  const mode = confirm ? "LIVE" : "PREVIEW";
  console.log(`Discord churn sweep KICK script. Mode: ${mode}${limit ? ` | limit ${limit}` : ""}`);
  if (!confirm) console.log("PREVIEW: no member will be removed. Pass --confirm for real removals.\n");
  else console.log("LIVE: members on the list WILL be removed from the server.\n");

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) stop("DISCORD_GUILD_ID is not set");

  const list = buildList();
  const work = limit ? list.slice(0, limit) : list;
  console.log(`Rows on the list: ${list.length} | rows to process: ${work.length}\n`);

  const guild = await loadJson(`/guilds/${guildId}`, "/guilds/{guildId}");
  const roles = await loadJson(`/guilds/${guildId}/roles`, "/guilds/{guildId}/roles");
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const everyoneRole = roleById.get(guildId);
  const protectPermsOf = (role) => {
    if (!role) return [];
    const bits = BigInt(role.permissions);
    return Object.entries(PROTECT_PERMS)
      .filter(([, bit]) => (bits & bit) !== 0n)
      .map(([name]) => name);
  };

  const results = [];
  const outFile = path.join(SWEEP_DIR, `kick-log-${stamp(new Date())}-${confirm ? "live" : "preview"}.csv`);
  const writeLog = () => {
    const cols = ["discord_id", "username", "role_names", "result", "detail"];
    const lines = [cols.join(",")].concat(results.map((r) => cols.map((c) => csvCell(r[c])).join(",")));
    fs.mkdirSync(SWEEP_DIR, { recursive: true });
    fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
  };
  const summary = () => {
    const counts = {};
    for (const r of results) counts[r.result] = (counts[r.result] || 0) + 1;
    console.log(`\nMode: ${mode}${limit ? ` | limit ${limit}` : ""}`);
    console.log(`Rows on the list: ${list.length} | rows processed: ${results.length}`);
    for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k.padEnd(14)} ${v}`);
    console.log(`Log: ${outFile}`);
  };
  const stopWithLog = (message) => {
    writeLog();
    summary();
    stop(message);
  };

  let consecutiveFailures = 0;
  let firstRemovalAttempted = false;

  for (let i = 0; i < work.length; i++) {
    const row = work[i];
    const id = row.discord_id;
    const record = (result, detail, member) => {
      const live = member ? member.roles.map((rid) => roleById.get(rid)?.name ?? rid).sort().join(" | ") : row.role_names;
      results.push({ discord_id: id, username: member?.user?.username ?? row.discord_username, role_names: live, result, detail });
      console.log(`[${String(i + 1).padStart(3)}/${work.length}] ${id}  ${result}${detail ? `  (${detail})` : ""}`);
    };

    // 1. Live member lookup
    const res = await discordGet(`/guilds/${guildId}/members/${id}`);
    if (!res) {
      record("failed", "member lookup rate limited twice");
      consecutiveFailures++;
    } else if (res.status === 404) {
      record("already_gone", "not in server");
    } else if (!res.ok) {
      record("failed", `member lookup HTTP ${res.status}`);
      consecutiveFailures++;
    } else {
      const member = await res.json();
      const memberRoles = member.roles.map((rid) => roleById.get(rid)).filter(Boolean);

      // 2. Protection rules
      const reasons = [];
      if (member.user?.bot) reasons.push("bot");
      if (id === guild.owner_id) reasons.push("guild owner");
      for (const r of [...memberRoles, everyoneRole].filter(Boolean)) {
        const perms = protectPermsOf(r);
        if (perms.length) reasons.push(`${r.name} grants ${perms.join("+")}`);
      }
      const unknownRoles = memberRoles.filter((r) => !REMOVABLE_ROLE_NAMES.has(r.name)).map((r) => r.name);
      const unknownIds = member.roles.filter((rid) => !roleById.has(rid));
      if (unknownRoles.length || unknownIds.length) reasons.push(`holds role(s) outside the removable set: ${[...unknownRoles, ...unknownIds].join(", ")}`);

      if (reasons.length > 0) {
        record("protected", reasons.join("; "), member);
      } else if (!confirm) {
        // 3. PREVIEW
        record("would_kick", "", member);
        consecutiveFailures = 0;
      } else {
        // 3. --confirm: real removal
        const kickRes = await kickMember(guildId, id);
        const status = kickRes ? kickRes.status : 0;
        if (!firstRemovalAttempted && status === 403) {
          record("failed", "HTTP 403", member);
          stopWithLog("Bot is missing Kick Members or its role is too low.");
        }
        firstRemovalAttempted = true;
        if (status === 204) {
          record("kicked", "", member);
          consecutiveFailures = 0;
        } else {
          record("failed", kickRes ? `HTTP ${status}` : "rate limited twice", member);
          consecutiveFailures++;
        }
      }
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      stopWithLog(`${MAX_CONSECUTIVE_FAILURES} failures in a row, stopping.`);
    }
    // 4. Pace between members
    if (i < work.length - 1) await sleep(PAUSE_MS);
  }

  writeLog();
  summary();
  console.log(confirm ? "\nLIVE run complete." : "\nPREVIEW complete. Nothing was removed.");
}

main().catch((err) => {
  console.error("STOP: unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
