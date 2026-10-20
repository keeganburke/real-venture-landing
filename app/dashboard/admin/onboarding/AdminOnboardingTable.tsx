"use client";

export type DiscordConnection = { discord_user_id: string; connected_at: string | null };

// One row per completed intake. Field names are the member_profiles columns
// written by app/api/intake/save/route.ts for the 7-question flow.
export type AdminOnboardingRow = {
  whop_user_id: string;
  display_name: string | null;
  intake_dream: string | null;
  whop_commitment_min: number | null;
  intake_tried: string[] | null;
  intake_tried_failure: string | null;
  intake_situation: string | null;
  intake_seriousness_scale: number | null;
  intake_seriousness_followup: string | null;
  intake_age: number | null;
  whop_phone: string | null;
  intake_completed_at: string | null;
  // Built by the page's in-code merge with discord_connections.
  discord_connections: DiscordConnection | null;
};

// Column headers are shortened forms of the real question copy in
// app/onboarding/intake-config.ts, and each label map is the exact option
// label the member clicked, so what admins read is what members saw.
const COMMITMENT_LABEL: Record<string, string> = {
  "15": "15 min · Casual",
  "30": "30 min · Regular",
  "60": "60 min · Serious",
  "120": "2+ hours · All in",
};
const TRIED_LABEL: Record<string, string> = {
  drop_shipping: "Dropshipping",
  trading: "Trading stocks or crypto",
  reselling: "Reselling stuff online",
  freelance: "Freelance work",
  content: "Content or social media",
  nothing: "Nothing yet",
  other: "Other",
};
const SITUATION_LABEL: Record<string, string> = {
  full_time: "Full-time job",
  part_time: "Part-time or gig",
  not_working: "Not working",
  in_school: "In school",
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
            <th>What would $5k change for you?</th>
            <th>Commitment</th>
            <th>Tried before</th>
            <th>What happened</th>
            <th>Situation</th>
            <th>Seriousness (1-10)</th>
            <th>Followup</th>
            <th>Age</th>
            <th>Phone</th>
            <th>Completed</th>
            <th>Discord</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.whop_user_id}>
              <td className="admin-td-member">
                <div className="admin-td-name">{r.display_name || EMPTY}</div>
                <div className="admin-td-id">{r.whop_user_id}</div>
              </td>
              <td className="admin-td-text" title={r.intake_dream ?? undefined}>
                {r.intake_dream || EMPTY}
              </td>
              <td>{fmtNumber(r.whop_commitment_min, COMMITMENT_LABEL)}</td>
              <td>{fmtArray(r.intake_tried, TRIED_LABEL)}</td>
              <td className="admin-td-text" title={r.intake_tried_failure ?? undefined}>
                {r.intake_tried_failure || EMPTY}
              </td>
              <td>{fmt(r.intake_situation, SITUATION_LABEL)}</td>
              <td>{fmtScale(r.intake_seriousness_scale)}</td>
              <td className="admin-td-text" title={r.intake_seriousness_followup ?? undefined}>
                {r.intake_seriousness_followup || EMPTY}
              </td>
              <td>{fmtNumber(r.intake_age)}</td>
              <td className="admin-td-mono">{r.whop_phone || EMPTY}</td>
              <td>{fmtDate(r.intake_completed_at)}</td>
              <td>
                {(() => {
                  const dc = r.discord_connections;
                  if (!dc) return <span className="admin-td-empty">Not connected</span>;
                  return (
                    <div>
                      <div className="admin-td-mono">{dc.discord_user_id}</div>
                      <div className="admin-td-id">{fmtDate(dc.connected_at)}</div>
                    </div>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
