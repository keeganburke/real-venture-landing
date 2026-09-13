"use client";

export type DiscordConnection = { discord_user_id: string; connected_at: string };

export type AdminOnboardingRow = {
  whop_user_id: string;
  display_name: string | null;
  intake_dream: string | null;
  intake_hours: string | null;
  intake_tried: string[] | null;
  intake_tried_failure: string | null;
  intake_worry: string | null;
  intake_identity: string | null;
  intake_invest: string | null;
  intake_seriousness: string | null;
  intake_completed_at: string | null;
  // Object when built by the page/route merge; array tolerated in case a
  // PostgREST embed is ever used instead (it returns arrays for to-many).
  discord_connections: DiscordConnection[] | DiscordConnection | null;
};

function discordOf(r: AdminOnboardingRow): DiscordConnection | null {
  const dc = Array.isArray(r.discord_connections) ? r.discord_connections[0] : r.discord_connections;
  return dc ?? null;
}

// Column headers are the real question copy from
// app/onboarding/intake-config.ts, and each enum map is the exact option
// label the member clicked, so what admins read is what members saw.
const HOURS_LABEL: Record<string, string> = {
  under_5: "Under 5 hours",
  five_ten: "5 to 10 hours",
  ten_twenty: "10 to 20 hours",
  twenty_plus: "More than 20 hours",
};
const TRIED_LABEL: Record<string, string> = {
  dropshipping: "Dropshipping",
  trading: "Trading stocks or crypto",
  reselling: "Reselling stuff online",
  freelance: "Freelance work",
  content: "Content or social media",
  nothing_yet: "Nothing yet",
  other: "Other",
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
            <th>What would your first $5,000 change for you?</th>
            <th>How many hours a week can you put into this?</th>
            <th>What have you tried before to make money?</th>
            <th>What happened?</th>
            <th>What&apos;s your biggest worry about starting?</th>
            <th>What&apos;s your situation right now?</th>
            <th>If a tool cost $200 and made you money faster, could you swing it?</th>
            <th>How serious are you about making this work?</th>
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
              <td className="admin-td-text">{r.intake_dream || EMPTY}</td>
              <td>{fmt(r.intake_hours, HOURS_LABEL)}</td>
              <td>{fmtArray(r.intake_tried, TRIED_LABEL)}</td>
              <td className="admin-td-text">{r.intake_tried_failure || EMPTY}</td>
              <td>{fmt(r.intake_worry, WORRY_LABEL)}</td>
              <td>{fmt(r.intake_identity, IDENTITY_LABEL)}</td>
              <td>{fmt(r.intake_invest, INVEST_LABEL)}</td>
              <td>{fmt(r.intake_seriousness, SERIOUSNESS_LABEL)}</td>
              <td>{fmtDate(r.intake_completed_at)}</td>
              <td>
                {(() => {
                  const dc = discordOf(r);
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
