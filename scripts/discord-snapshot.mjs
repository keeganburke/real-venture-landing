// Discord permission snapshot. READ ONLY: every Discord call is a GET.
//
// Fetches the guild, its roles, its channels and all members (for role
// counts), writes the raw guild / roles / channels responses unmodified to
// ~/Desktop/discord-sweep/snapshot-<YYYY-MM-DD-HHmm>.json, and prints a
// readable permission summary. Changes nothing anywhere.
//
// Run:  node --env-file=.env.local scripts/discord-snapshot.mjs
//
// Same Discord GET helper and env usage as scripts/discord-sweep-dryrun.mjs
// (DISCORD_GUILD_ID, DISCORD_BOT_TOKEN).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DISCORD_API = "https://discord.com/api/v10";

// Discord permission flags (bit positions), from the Discord API reference.
const PERMISSIONS = {
  CREATE_INSTANT_INVITE: 0n,
  KICK_MEMBERS: 1n,
  BAN_MEMBERS: 2n,
  ADMINISTRATOR: 3n,
  MANAGE_CHANNELS: 4n,
  MANAGE_GUILD: 5n,
  ADD_REACTIONS: 6n,
  VIEW_AUDIT_LOG: 7n,
  PRIORITY_SPEAKER: 8n,
  STREAM: 9n,
  VIEW_CHANNEL: 10n,
  SEND_MESSAGES: 11n,
  SEND_TTS_MESSAGES: 12n,
  MANAGE_MESSAGES: 13n,
  EMBED_LINKS: 14n,
  ATTACH_FILES: 15n,
  READ_MESSAGE_HISTORY: 16n,
  MENTION_EVERYONE: 17n,
  USE_EXTERNAL_EMOJIS: 18n,
  VIEW_GUILD_INSIGHTS: 19n,
  CONNECT: 20n,
  SPEAK: 21n,
  MUTE_MEMBERS: 22n,
  DEAFEN_MEMBERS: 23n,
  MOVE_MEMBERS: 24n,
  USE_VAD: 25n,
  CHANGE_NICKNAME: 26n,
  MANAGE_NICKNAMES: 27n,
  MANAGE_ROLES: 28n,
  MANAGE_WEBHOOKS: 29n,
  MANAGE_GUILD_EXPRESSIONS: 30n,
  USE_APPLICATION_COMMANDS: 31n,
  REQUEST_TO_SPEAK: 32n,
  MANAGE_EVENTS: 33n,
  MANAGE_THREADS: 34n,
  CREATE_PUBLIC_THREADS: 35n,
  CREATE_PRIVATE_THREADS: 36n,
  USE_EXTERNAL_STICKERS: 37n,
  SEND_MESSAGES_IN_THREADS: 38n,
  USE_EMBEDDED_ACTIVITIES: 39n,
  MODERATE_MEMBERS: 40n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 41n,
  USE_SOUNDBOARD: 42n,
  CREATE_GUILD_EXPRESSIONS: 43n,
  CREATE_EVENTS: 44n,
  USE_EXTERNAL_SOUNDS: 45n,
  SEND_VOICE_MESSAGES: 46n,
  SEND_POLLS: 49n,
  USE_EXTERNAL_APPS: 50n,
};

// The subset reported per role in section 1.
const ROLE_REPORT_PERMS = [
  "VIEW_CHANNEL",
  "SEND_MESSAGES",
  "CONNECT",
  "MENTION_EVERYONE",
  "ADMINISTRATOR",
  "MANAGE_ROLES",
  "MANAGE_CHANNELS",
  "KICK_MEMBERS",
];

const CHANNEL_TYPES = {
  0: "text",
  2: "voice",
  4: "category",
  5: "announcement",
  10: "announcement-thread",
  11: "public-thread",
  12: "private-thread",
  13: "stage",
  14: "directory",
  15: "forum",
  16: "media",
};

function stop(message) {
  console.error(`STOP: ${message}`);
  process.exit(1);
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

async function getJson(pathname, label) {
  const res = await discordGet(pathname);
  if (res.status === 403 && pathname.includes("/members")) stop("Server Members Intent is off for this bot.");
  if (!res.ok) stop(`GET ${label} returned ${res.status}`);
  return res.json();
}

async function loadMembers(guildId) {
  const members = [];
  let after = "0";
  for (;;) {
    const page = await getJson(`/guilds/${guildId}/members?limit=1000&after=${after}`, "/guilds/{guildId}/members");
    members.push(...page);
    if (page.length < 1000) break;
    after = page[page.length - 1].user.id;
  }
  return members;
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

function bitsOf(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function has(bits, name) {
  return (bits & (1n << PERMISSIONS[name])) !== 0n;
}

// Names every set bit; unknown bits are reported as BIT_<n>.
function namesOf(bits) {
  const out = [];
  const known = new Map(Object.entries(PERMISSIONS).map(([name, pos]) => [pos, name]));
  for (let pos = 0n; pos < 64n; pos++) {
    if ((bits & (1n << pos)) !== 0n) out.push(known.get(pos) ?? `BIT_${pos}`);
  }
  return out;
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// Two overwrite lists are "equal" when they hold the same (id, type, allow, deny) entries.
function overwritesKey(list) {
  return (list ?? [])
    .map((o) => `${o.type}:${o.id}:${bitsOf(o.allow)}:${bitsOf(o.deny)}`)
    .sort()
    .join("|");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Discord permission snapshot. READ ONLY: GET requests only, nothing is changed.\n");

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) stop("DISCORD_GUILD_ID is not set");

  const guild = await getJson(`/guilds/${guildId}`, "/guilds/{guildId}");
  const roles = await getJson(`/guilds/${guildId}/roles`, "/guilds/{guildId}/roles");
  const channels = await getJson(`/guilds/${guildId}/channels`, "/guilds/{guildId}/channels");
  const members = await loadMembers(guildId);

  // Raw snapshot, unmodified responses.
  const now = new Date();
  const outDir = path.join(os.homedir(), "Desktop", "discord-sweep");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `snapshot-${stamp(now)}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ fetched_at: now.toISOString(), guild, roles, channels }, null, 2) + "\n",
    "utf8"
  );

  const roleById = new Map(roles.map((r) => [r.id, r]));
  const memberName = new Map(members.map((m) => [m.user.id, m.nick ?? m.user.global_name ?? m.user.username]));
  const roleCount = new Map();
  for (const m of members) for (const rid of m.roles) roleCount.set(rid, (roleCount.get(rid) || 0) + 1);

  console.log(`Guild: ${guild.name} (${guild.id}) | owner ${memberName.get(guild.owner_id) ?? guild.owner_id} (${guild.owner_id})`);
  console.log(`Members fetched: ${members.length} | roles: ${roles.length} | channel objects: ${channels.length}`);
  console.log(`Raw snapshot written: ${outFile}\n`);

  // 1. Roles
  console.log("1. ROLES (highest position first)");
  const sortedRoles = [...roles].sort((a, b) => b.position - a.position);
  for (const r of sortedRoles) {
    const bits = bitsOf(r.permissions);
    const grants = ROLE_REPORT_PERMS.filter((p) => has(bits, p));
    const count = r.id === guild.id ? members.length : roleCount.get(r.id) || 0;
    console.log(
      `  [${String(r.position).padStart(2)}] ${r.name}  id=${r.id}  managed=${Boolean(r.managed)}  members=${count}` +
        `  grants: ${grants.length ? grants.join(", ") : "(none of the 8 tracked)"}`
    );
  }

  // 2. Channels by category
  console.log("\n2. CHANNELS BY CATEGORY (display order)");
  const nameFor = (o) =>
    o.type === 0
      ? o.id === guild.id
        ? "@everyone"
        : `role ${roleById.get(o.id)?.name ?? o.id}`
      : `member ${memberName.get(o.id) ?? o.id}`;
  const fmtOverwrites = (list, indent) => {
    if (!list || list.length === 0) return `${indent}(no overwrites)`;
    return list
      .map((o) => {
        const allow = namesOf(bitsOf(o.allow));
        const deny = namesOf(bitsOf(o.deny));
        return `${indent}${nameFor(o)}: allow [${allow.join(", ")}] deny [${deny.join(", ")}]`;
      })
      .join("\n");
  };
  const typeName = (c) => CHANNEL_TYPES[c.type] ?? `type-${c.type}`;
  const isVoiceLike = (c) => c.type === 2 || c.type === 13;
  const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id);
  const childSort = (a, b) => Number(isVoiceLike(a)) - Number(isVoiceLike(b)) || byPos(a, b);

  const categories = channels.filter((c) => c.type === 4).sort(byPos);
  const children = channels.filter((c) => c.type !== 4);
  const groups = [{ cat: null, items: children.filter((c) => !c.parent_id).sort(childSort) }].concat(
    categories.map((cat) => ({ cat, items: children.filter((c) => c.parent_id === cat.id).sort(childSort) }))
  );
  const orphans = children.filter((c) => c.parent_id && !categories.some((cat) => cat.id === c.parent_id));
  if (orphans.length) groups.push({ cat: { name: "(parent category not in response)", id: "?", permission_overwrites: [] }, items: orphans.sort(childSort) });

  let syncedCount = 0;
  for (const g of groups) {
    if (g.cat === null && g.items.length === 0) continue;
    if (g.cat === null) {
      console.log("\n  (no category)");
    } else {
      console.log(`\n  CATEGORY ${g.cat.name}  id=${g.cat.id}`);
      console.log(fmtOverwrites(g.cat.permission_overwrites, "    "));
    }
    const catKey = g.cat ? overwritesKey(g.cat.permission_overwrites) : null;
    for (const c of g.items) {
      const synced = catKey !== null && overwritesKey(c.permission_overwrites) === catKey;
      if (synced) syncedCount++;
      console.log(`    - ${c.name}  [${typeName(c)}]${synced ? "  (synced)" : ""}  id=${c.id}`);
      if (!synced) console.log(fmtOverwrites(c.permission_overwrites, "        "));
    }
  }

  // 3. @everyone explicit overwrites
  console.log("\n3. CHANNELS / CATEGORIES WITH AN EXPLICIT @everyone OVERWRITE");
  const everyoneHits = channels
    .map((c) => ({ c, o: (c.permission_overwrites ?? []).find((o) => o.type === 0 && o.id === guild.id) }))
    .filter((x) => x.o)
    .sort((a, b) => byPos(a.c, b.c));
  if (everyoneHits.length === 0) console.log("  (none)");
  for (const { c, o } of everyoneHits) {
    const parent = c.parent_id ? ` in ${channels.find((p) => p.id === c.parent_id)?.name ?? c.parent_id}` : "";
    console.log(
      `  ${c.name} [${typeName(c)}]${parent}: allow [${namesOf(bitsOf(o.allow)).join(", ")}] deny [${namesOf(bitsOf(o.deny)).join(", ")}]`
    );
  }

  // 4. Totals
  console.log("\n4. TOTALS");
  console.log(`  categories: ${categories.length}`);
  const byType = new Map();
  for (const c of children) byType.set(typeName(c), (byType.get(typeName(c)) || 0) + 1);
  for (const [t, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) console.log(`  channels (${t}): ${n}`);
  console.log(`  channels total (non-category): ${children.length} | synced with their category: ${syncedCount}`);
  console.log(`  roles: ${roles.length} (including @everyone)`);
  console.log("\nSnapshot complete. Nothing was changed.");
}

main().catch((err) => {
  console.error("STOP: unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
