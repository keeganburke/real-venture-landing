// READ ONLY staff check for the new login gate. Discord: GET the guild's
// roles and members (no writes). Supabase: SELECT discord_connections. Whop:
// GET memberships (the gate's own read). Prints Discord usernames and the
// gate's answer only: no Whop ids, emails or names.
//   JITI_ALIAS={"@/":"<repo>/"} node --env-file=.env.local node_modules/.bin/jiti scripts/staff-gate-check.ts [extra discord usernames...]
const keepAlive = setInterval(() => {}, 1000);
import { createAdminClient } from "../lib/supabase/admin";
import { isAdmin } from "../lib/admin-allowlist";
import * as gate from "../lib/whop-access";
const { readWhopAccess, hubAllowlisted } = gate;
// the five staff roles (Owner, Founder, Group Coach, Underwriter, Moderator),
// the same ids lib/discord-kick.ts never kicks; the gate's own list once it has one
const g = gate as unknown as { staffRoleIds?: () => Set<string>; hubStaffByDiscord?: (id: string) => Promise<boolean> };
const staffRoleIds = g.staffRoleIds ?? (() => new Set(["1268122306107150400", "1520610290067308625", "1520606504338853979", "1461080076056789024", "1268122373681451053"]));
const hubStaffByDiscord = g.hubStaffByDiscord ?? (async () => false);

const extra = process.argv.slice(2).map((s) => s.toLowerCase());
const token = process.env.DISCORD_BOT_TOKEN!;
const guild = process.env.DISCORD_GUILD_ID!;
const H = { Authorization: `Bot ${token}` };
const get = async (p: string) => {
  const r = await fetch(`https://discord.com/api/v10${p}`, { headers: H, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`discord ${r.status} on ${p.split("?")[0]}`);
  return r.json();
};
const roles: { id: string; name: string }[] = await get(`/guilds/${guild}/roles`);
const roleName = new Map(roles.map((r) => [r.id, r.name]));
const staff = staffRoleIds();
console.log("staff roles:", [...staff].map((id) => roleName.get(id) ?? `missing ${id}`).join(", "));
const members: any[] = [];
let after = "0";
for (let i = 0; i < 50; i++) {
  const page: any[] = await get(`/guilds/${guild}/members?limit=1000&after=${after}`);
  members.push(...page);
  if (page.length < 1000) break;
  after = page[page.length - 1].user.id;
}
console.log("guild members read:", members.length);
const picked = members.filter((m) => !m.user?.bot && (m.roles.some((r: string) => staff.has(r)) || extra.includes(String(m.user.username).toLowerCase()) || /william/i.test(`${m.user.username} ${m.user.global_name ?? ""} ${m.nick ?? ""}`)));
const { data: links } = await createAdminClient().from("discord_connections").select("discord_user_id, whop_user_id");
const byDiscord = new Map((links ?? []).map((l: any) => [l.discord_user_id, l.whop_user_id as string]));
const FILTER_IGNORED: any[] = [];
const WH = { Authorization: `Bearer ${process.env.WHOP_API_KEY}`, Accept: "application/json", "Api-Version-Date": "2026-10-15-1" };
async function whopByDiscordRaw(discordId: string): Promise<any[]> {
  const p = new URLSearchParams({ company_id: process.env.WHOP_COMPANY_ID!, external_account: `discord_${discordId}`, first: "50" });
  const r = await fetch(`https://api.whop.com/api/v1/memberships?${p}`, { headers: WH, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`whop ${r.status}`);
  return ((await r.json()).data ?? []).filter((x: any) => (x.product_id ?? x.product?.id) === process.env.WHOP_PRODUCT_ID);
}
// does Whop honour the filter? a made-up Discord id must return nothing
const probe = await whopByDiscordRaw("100000000000000001");
const filterWorks = probe.length === 0;
console.log("Whop Discord lookup honours the filter (made-up id returns 0 rows):", filterWorks);
const whopByDiscord = async (id: string) => (filterWorks ? whopByDiscordRaw(id) : FILTER_IGNORED);
const rows: string[] = [];
const counts: Record<string, number> = {};
for (const m of picked) {
  const name = m.user.username;
  const held = m.roles.filter((r: string) => staff.has(r)).map((r: string) => roleName.get(r)).join("+") || "(no staff role)";
  const whop = byDiscord.get(m.user.id);
  let verdict: string;
  if (!whop) {
    // Whop's own Discord link: memberships whose owner connected this Discord
    // account inside Whop (read only). Owner checked across rows.
    const rows = await whopByDiscord(m.user.id);
    const owners = [...new Set(rows.map((r: any) => r.user_id ?? r.user?.id))];
    if (rows === FILTER_IGNORED) verdict = "no hub link; Whop's Discord lookup unusable";
    else if (owners.length === 0) verdict = "LOCKED OUT: no hub link, and no Real Venture membership tied to this Discord in Whop";
    else if (owners.length > 1) verdict = `unclear: Whop ties this Discord to ${owners.length} Whop accounts`;
    else {
      const w = owners[0] as string;
      const a = isAdmin(w) ? null : await readWhopAccess(w);
      verdict = isAdmin(w) ? "admin (found through Whop's Discord link)" : a!.kind === "member" ? "member (found through Whop's Discord link)" : `LOCKED OUT (${a!.kind === "ended" ? "membership ended" : a!.kind}; found through Whop's Discord link)`;
    }
  }
  else if (isAdmin(whop)) verdict = "admin";
  else {
    const a = await readWhopAccess(whop);
    if (a.kind === "member") verdict = "member";
    else if (a.kind === "error" || a.kind === "untrusted") verdict = `Whop could not answer (${a.kind}), rerun`;
    else if (await hubAllowlisted(whop)) verdict = (await hubStaffByDiscord(whop)) ? `staff role (would be ${a.kind} without it)` : `never-kick list (would be ${a.kind} without it)`;
    else verdict = `LOCKED OUT (${a.kind === "ended" ? "membership ended" : "no membership"})`;
  }
  const key = verdict.split(" (")[0].split(":")[0];
  counts[key] = (counts[key] ?? 0) + 1;
  rows.push(`${name.padEnd(22)} ${held.padEnd(28)} ${verdict}`);
}
for (const e of extra) if (!picked.some((m) => String(m.user.username).toLowerCase() === e)) rows.push(`${e.padEnd(22)} ${"(not in the server)".padEnd(28)} not found by username`);
console.log(rows.sort().join("\n"));
console.log("totals:", JSON.stringify(counts));
clearInterval(keepAlive);
