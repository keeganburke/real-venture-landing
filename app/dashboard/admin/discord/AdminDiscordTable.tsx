"use client";

import { useState } from "react";

export type AdminDiscordRow = {
  whop_user_id: string;
  display_name: string | null;
  created_at: string | null;
  // From Whop membership.joined_at (migration 016), kept current by the backfill.
  whop_joined_at: string | null;
  intake_completed_at: string | null;
  // member_profiles.whop_tier / whop_plan_id (migration 018), backfilled from Whop.
  whop_tier: string | null;
  whop_plan_id: string | null;
  // member_profiles.whop_display_name / whop_username (migration 019).
  whop_display_name: string | null;
  whop_username: string | null;
  discord_connections: {
    discord_user_id: string;
    // discord_connections.discord_username (migration 019), saved by the callback.
    discord_username: string | null;
    tier: string | null;
    role_id: string | null;
    connected_at: string | null;
  } | null;
};

type Filter = "all" | "connected" | "not_connected";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "connected", label: "Connected" },
  { key: "not_connected", label: "Not Connected" },
];

const EMPTY = "-";

// Same crown art as the pricing cards (public/crowns/*.png, 800x700).
// Base and Pro get a crown; any other non-null tier renders as its text
// label; null renders "-".
const TIER_CROWNS: Record<string, string> = {
  Base: "/crowns/base.png",
  Pro: "/crowns/pro.png",
};

function TierCrown({ tier }: { tier: string | null }) {
  if (!tier) return <>{EMPTY}</>;
  const src = TIER_CROWNS[tier];
  if (!src) return <>{tier}</>;
  return (
    <img
      src={src}
      alt={tier}
      title={tier}
      className="tier-crown-icon"
      width={28}
      height={25}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    />
  );
}

// Time from Whop purchase (whop_joined_at) to first profile write
// (member_profiles.created_at). Rendered as a coloured pill.
function timeToLogin(
  bought: string | null,
  firstLogin: string | null
): { label: string; cls: string } {
  const toMs = (v: string | null) => {
    if (!v) return null;
    const ms = new Date(v).getTime();
    return Number.isNaN(ms) ? null : ms;
  };
  const b = toMs(bought);
  const f = toMs(firstLogin);
  if (b === null) return { label: EMPTY, cls: "ttl-pill ttl-none" };
  if (f === null) return { label: "never", cls: "ttl-pill ttl-slow" };
  const delta = f - b;
  if (delta < 0) return { label: EMPTY, cls: "ttl-pill ttl-none" };
  const mins = Math.floor(delta / 60_000);
  const hours = Math.floor(delta / 3_600_000);
  const days = Math.floor(delta / 86_400_000);
  let label: string;
  if (hours < 1) label = `${mins}m`;
  else if (hours < 24) label = `${hours}h ${mins % 60}m`;
  else if (days < 7) label = `${days} day${days === 1 ? "" : "s"}`;
  else label = `${Math.floor(days / 7)}w`;
  const cls = days < 1 ? "ttl-fast" : days < 7 ? "ttl-mid" : "ttl-slow";
  return { label, cls: `ttl-pill ${cls}` };
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return EMPTY;
  try {
    return new Date(v).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
}

export function AdminDiscordTable({ rows }: { rows: AdminDiscordRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Search across the visible identity columns, then apply the tab filter,
  // so both narrow the same list.
  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (r: AdminDiscordRow) => {
    if (!q) return true;
    const dc = r.discord_connections;
    return [
      r.whop_display_name,
      r.whop_username,
      r.display_name,
      r.whop_user_id,
      r.whop_tier,
      dc?.discord_username,
      dc?.discord_user_id,
    ].some((v) => typeof v === "string" && v.toLowerCase().includes(q));
  };

  const visible = rows.filter((r) => {
    if (!matchesSearch(r)) return false;
    if (filter === "connected") return Boolean(r.discord_connections);
    if (filter === "not_connected") return !r.discord_connections;
    return true;
  });

  return (
    <>
      <input
        type="search"
        placeholder="Search by name, username, whop id, tier..."
        className="admin-search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        aria-label="Search members"
      />
      <div className="admin-filter-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`admin-filter-tab${filter === f.key ? " active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="admin-empty">
          {rows.length === 0 ? "No members in member_profiles yet." : q ? "No members match this search." : "No members match this filter."}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Name</th>
                <th>Bought</th>
                <th>First login</th>
                <th title="Time to login: Whop purchase to first login">TTL</th>
                <th>Onboarding</th>
                <th>Discord</th>
                <th>Discord username</th>
                <th>Tier</th>
                <th>Discord connected on</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const dc = r.discord_connections;
                return (
                  <tr key={r.whop_user_id} className={dc ? undefined : "admin-row-warn"}>
                    <td className="admin-td-member">
                      <div className="admin-td-name">{r.display_name || EMPTY}</div>
                      <div className="admin-td-id">{r.whop_user_id}</div>
                    </td>
                    <td>{r.whop_display_name || r.whop_username || EMPTY}</td>
                    <td>{fmtDate(r.whop_joined_at)}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>
                      {(() => {
                        const ttl = timeToLogin(r.whop_joined_at, r.created_at);
                        return <span className={ttl.cls}>{ttl.label}</span>;
                      })()}
                    </td>
                    <td>{r.intake_completed_at ? "✅ done" : "⏳ pending"}</td>
                    <td>
                      {dc ? (
                        <div>
                          <div>{"✅ connected"}</div>
                          <div className="admin-td-mono">{dc.discord_user_id}</div>
                        </div>
                      ) : (
                        <span>{"❌ not connected"}</span>
                      )}
                    </td>
                    <td>{dc?.discord_username || EMPTY}</td>
                    <td><TierCrown tier={r.whop_tier ?? dc?.tier ?? null} /></td>
                    <td>{fmtDate(dc?.connected_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
