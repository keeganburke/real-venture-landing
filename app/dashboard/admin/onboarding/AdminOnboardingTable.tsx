"use client";

export type DiscordConnection = { discord_user_id: string; discord_username: string | null; connected_at: string | null };

// One row per completed intake. Field names are the member_profiles columns
// app/api/intake/save/route.ts writes for the live 7-question flow
// (app/onboarding/intake-config.ts), plus the five columns the Sept 2026 flow
// wrote (hours, worry, identity, invest, seriousness): rows completed before
// the rewrite only have those, so they are shown in one "Older flow" column.
export type AdminOnboardingRow = {
  whop_user_id: string;
  // What the member typed on their profile (rare), then Whop's name and
  // username from the backfill (migration 019).
  display_name: string | null;
  whop_display_name: string | null;
  whop_username: string | null;
  intake_dream: string | null;
  whop_commitment_min: number | null;
  intake_tried: string[] | null;
  intake_tried_failure: string | null;
  intake_situation: string | null;
  intake_seriousness_scale: number | null;
  intake_seriousness_followup: string | null;
  intake_age: number | null;
  whop_phone: string | null;
  intake_hours: string | null;
  intake_worry: string | null;
  intake_identity: string | null;
  intake_invest: string | null;
  intake_seriousness: string | null;
  intake_completed_at: string | null;
  // Built by the page's in-code merge with discord_connections.
  discord_connections: DiscordConnection | null;
};

// Column headers are shortened forms of the live question copy in
// app/onboarding/intake-config.ts; each label map is the exact option label
// the member clicked, so what admins read is what members saw.
const COMMITMENT_LABEL: Record<string, string> = {
  "15": "15 minutes",
  "30": "30 minutes",
  "60": "1 hour",
  "120": "2+ hours",
};
// Live values first; the Sept 2026 flow wrote dropshipping / nothing_yet.
const TRIED_LABEL: Record<string, string> = {
  drop_shipping: "Dropshipping",
  dropshipping: "Dropshipping",
  trading: "Trading stocks or crypto",
  reselling: "Reselling stuff online",
  freelance: "Freelance work",
  content: "Content or social media",
  nothing: "Nothing yet",
  nothing_yet: "Nothing yet",
  other: "Other",
};
const SITUATION_LABEL: Record<string, string> = {
  full_time: "Working full time",
  part_time: "Working part time",
  not_working: "Not working",
  in_school: "In school",
};
// Sept 2026 flow (columns kept by migration 021), labels as they were then.
const HOURS_LABEL: Record<string, string> = {
  under_5: "Under 5 hours",
  five_ten: "5 to 10 hours",
  ten_twenty: "10 to 20 hours",
  twenty_plus: "More than 20 hours",
};
const WORRY_LABEL: Record<string, string> = {
  time: "I don't have enough time",
  money: "I don't have money to spend on tools",
  fail_again: "I'm scared I'll fail again",
  consistency: "I don't know if I can stick with it",
};
const IDENTITY_LABEL: Record<string, string> = {
  full_time: "Working a full-time job",
  part_time_gig: "Working part-time or side gigs",
  not_working: "Not working right now",
  student: "In school",
};
const INVEST_LABEL: Record<string, string> = {
  easy: "Yes, no problem",
  manageable: "Yes, once I see it working",
  stretch: "Not right now",
  not_sure: "Not sure",
};
const SERIOUSNESS_LABEL: Record<string, string> = {
  curious: "Just checking it out",
  interested: "Pretty interested",
  committed: "Committed",
  all_in: "All in",
};

const EMPTY = "-";

function fmt(v: string | null | undefined, map?: Record<string, string>): string {
  if (!v) return EMPTY;
  if (map) return map[v] ?? v;
  return v;
}
function fmtArray(v: string[] | null | undefined, map?: Record<string, string>): string {
  if (!v || v.length === 0) return EMPTY;
  if (map) return v.map((x) => map[x] ?? x).join(", ");
  return v.join(", ");
}
// Integer columns come back as numbers; a label map keys them as strings.
function fmtNumber(v: number | null | undefined, map?: Record<string, string>): string {
  if (v === null || v === undefined) return EMPTY;
  if (map) return map[String(v)] ?? String(v);
  return String(v);
}
function fmtScale(v: number | null | undefined): string {
  if (v === null || v === undefined) return EMPTY;
  return `${v}/10`;
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
// The Sept 2026 answers, one compact cell; empty for rows from the live flow.
function legacyAnswers(r: AdminOnboardingRow): string {
  const parts = [
    r.intake_hours ? `Hours/week: ${fmt(r.intake_hours, HOURS_LABEL)}` : null,
    r.intake_worry ? `Worry: ${fmt(r.intake_worry, WORRY_LABEL)}` : null,
    r.intake_identity ? `Situation: ${fmt(r.intake_identity, IDENTITY_LABEL)}` : null,
    r.intake_invest ? `$200 tool: ${fmt(r.intake_invest, INVEST_LABEL)}` : null,
    r.intake_seriousness ? `Serious: ${fmt(r.intake_seriousness, SERIOUSNESS_LABEL)}` : null,
  ].filter((p): p is string => p !== null);
  return parts.length ? parts.join(" | ") : EMPTY;
}

export function AdminOnboardingTable({ rows }: { rows: AdminOnboardingRow[] }) {
  if (rows.length === 0) {
    return <div className="admin-empty">No completed onboarding responses yet.</div>;
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>What would $5k change?</th>
            <th>Time per day</th>
            <th>Tried before</th>
            <th>Then what happened?</th>
            <th>Situation</th>
            <th>Committed (1-10)</th>
            <th>Follow-up</th>
            <th>Age</th>
            <th>Phone</th>
            <th>Older flow (Sept 2026)</th>
            <th>Completed</th>
            <th>Discord</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const dc = r.discord_connections;
            const name = r.display_name || r.whop_display_name || r.whop_username || EMPTY;
            return (
              <tr key={r.whop_user_id}>
                <td className="admin-td-member">
                  <div className="admin-td-name">{name}</div>
                  {r.whop_username ? <div className="admin-td-id">@{r.whop_username}</div> : null}
                  {dc?.discord_username ? <div className="admin-td-id">Discord: {dc.discord_username}</div> : null}
                  <div className="admin-td-id">{r.whop_user_id}</div>
                </td>
                <td className="admin-td-text" title={r.intake_dream ?? undefined}>{r.intake_dream || EMPTY}</td>
                <td>{fmtNumber(r.whop_commitment_min, COMMITMENT_LABEL)}</td>
                <td>{fmtArray(r.intake_tried, TRIED_LABEL)}</td>
                <td className="admin-td-text" title={r.intake_tried_failure ?? undefined}>{r.intake_tried_failure || EMPTY}</td>
                <td>{fmt(r.intake_situation, SITUATION_LABEL)}</td>
                <td>{fmtScale(r.intake_seriousness_scale)}</td>
                <td className="admin-td-text" title={r.intake_seriousness_followup ?? undefined}>{r.intake_seriousness_followup || EMPTY}</td>
                <td>{fmtNumber(r.intake_age)}</td>
                <td className="admin-td-mono">{r.whop_phone || EMPTY}</td>
                <td className="admin-td-text">{legacyAnswers(r)}</td>
                <td>{fmtDate(r.intake_completed_at)}</td>
                <td>
                  {!dc ? (
                    <span className="admin-td-empty">Not connected</span>
                  ) : (
                    <div>
                      <div className="admin-td-mono">{dc.discord_username ?? dc.discord_user_id}</div>
                      <div className="admin-td-id">{fmtDate(dc.connected_at)}</div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
