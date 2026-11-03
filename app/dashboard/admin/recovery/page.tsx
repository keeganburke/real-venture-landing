import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { isAdmin } from "../../../../lib/admin-allowlist";
import { chicagoMidnightMs } from "../../../../lib/payment-recovery";
import { computeBaseline, loadRecoveryStats, pct, usd, type SequenceRow } from "../../../../lib/payment-recovery-stats";

// Payment-recovery results (migration 031). Same admin gate as the other
// /dashboard/admin pages. Date range = Chicago calendar days, inclusive,
// default the last 30 days; filters on when the drip first saw the sequence.
export const dynamic = "force-dynamic";

const TZ = "America/Chicago";

function dateInput(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "-";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}
function fmtDate(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "-" : new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));
}
function first(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
}
function outcomeLabel(o: SequenceRow["outcome"]): string {
  return o === "paid" ? "Recovered" : o === "canceled" ? "Canceled" : o === "expired" ? "Expired" : o === "open" ? "Open" : "Other";
}

// Range from the query (Chicago calendar days, inclusive), default the last
// 30 days. Reads the clock here, outside the component body.
function resolveRange(fromParam: string | null, toParam: string | null) {
  const now = Date.now();
  const defaultTo = dateInput(now);
  const defaultFrom = dateInput(now - 29 * 86400000);
  const fromStr = fromParam ?? defaultFrom;
  const toStr = toParam ?? defaultTo;
  const fromMs = chicagoMidnightMs(fromStr) ?? chicagoMidnightMs(defaultFrom) ?? now - 30 * 86400000;
  const toStart = chicagoMidnightMs(toStr) ?? chicagoMidnightMs(defaultTo) ?? now;
  // Inclusive end day, plus an hour so the DST switch day is fully covered.
  const toMs = toStart + 86400000 + 3600000;
  return { now, fromStr, toStr, fromMs, toMs };
}

const cell: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" };
const head: React.CSSProperties = { ...cell, textAlign: "left", fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.04em" };
const section: React.CSSProperties = { marginTop: 28 };
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: "0 0 10px" };
const note: React.CSSProperties = { fontSize: 13, opacity: 0.7, margin: "6px 0 0" };

export default async function AdminRecoveryPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session?.whopUserId) redirect("/api/auth/whop/start");
  if (!isAdmin(session.whopUserId)) redirect("/dashboard");

  const sp = await searchParams;
  const { now, fromStr, toStr, fromMs, toMs } = resolveRange(first(sp.from), first(sp.to));

  const [stats, baseline] = await Promise.all([loadRecoveryStats(fromMs, toMs), computeBaseline(now)]);
  const diff = stats.rate !== null && baseline.rate !== null ? (stats.rate - baseline.rate) * 100 : null;

  return (
    <div className="admin-page">
      <div className="admin-nav">
        <Link href="/dashboard/admin/onboarding" className="admin-nav-link">Onboarding</Link>
        <Link href="/dashboard/admin/discord" className="admin-nav-link">Discord</Link>
        <Link href="/dashboard/admin/recovery" className="admin-nav-link active">Recovery</Link>
      </div>
      <div className="admin-header">
        <h1 className="admin-title">Payment Recovery Results</h1>
      </div>

      <form method="get" style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", margin: "8px 0 18px" }}>
        <label style={{ fontSize: 13 }}>
          From<br />
          <input type="date" name="from" defaultValue={fromStr} className="admin-search" />
        </label>
        <label style={{ fontSize: 13 }}>
          To<br />
          <input type="date" name="to" defaultValue={toStr} className="admin-search" />
        </label>
        <button type="submit" className="admin-filter-tab active">Apply</button>
        <Link href="/dashboard/admin/recovery" className="admin-filter-tab">Last 30 days</Link>
        <span style={note}>Chicago days, inclusive. Counts sequences the drip first saw in this range.</span>
      </form>

      {stats.errors.length > 0 && (
        <div className="admin-row-warn" style={{ padding: 10, marginBottom: 14, fontSize: 13 }}>
          {stats.errors.map((e) => <div key={e}>{e}</div>)}
          <div>If migration 031 has not run yet, the links table is missing and clicks read as 0. If 032 has not run yet, the replies table is missing and replies read as 0.</div>
        </div>
      )}

      <div className="admin-stats-row">
        <div className="admin-stat-card"><div className="admin-stat-label">Past due entered</div><div className="admin-stat-value">{stats.entered}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Messaged</div><div className="admin-stat-value">{stats.messaged}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Recovered (paid)</div><div className="admin-stat-value gold">{stats.recovered}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Lost (canceled or expired)</div><div className="admin-stat-value">{stats.lost}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Still open</div><div className="admin-stat-value">{stats.open}</div></div>
      </div>
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Recovery rate</div>
          <div className="admin-stat-value gold">{pct(stats.rate)}</div>
          <div style={note}>recovered / entered{diff !== null ? `, ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts vs baseline` : ""}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Baseline before launch</div>
          <div className="admin-stat-value">{baseline.ok ? pct(baseline.rate) : "n/a"}</div>
          <div style={note}>
            {baseline.ok
              ? `${baseline.paid} of ${baseline.failedRenewals} failed renewals paid, ${fmtDate(baseline.windowFrom)} to ${fmtDate(baseline.windowTo)} (${baseline.launched ? "90 days before the first live send" : "last 90 days, not launched yet"}), from Whop`
              : `Whop baseline unavailable: ${baseline.error ?? "unknown"}`}
            {baseline.warnings.length > 0 ? ` | ${baseline.warnings.join("; ")}` : ""}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">$ recovered</div>
          <div className="admin-stat-value gold">{usd(stats.recoveredAmount)}</div>
          <div style={note}>sum of the paid renewals (Whop payment totals)</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">First message to paid</div>
          <div className="admin-stat-value">{stats.hoursToPaid.median !== null ? `${stats.hoursToPaid.median.toFixed(1)} h` : "-"}</div>
          <div style={note}>median{stats.hoursToPaid.average !== null ? `, average ${stats.hoursToPaid.average.toFixed(1)} h` : ""}, {stats.hoursToPaid.n} paid after a message</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        <section style={section}>
          <h2 style={h2}>$ recovered per month</h2>
          <table className="admin-table"><thead><tr><th style={head}>Month (paid)</th><th style={head}>Recovered</th><th style={head}>$</th></tr></thead>
            <tbody>{stats.perMonth.length === 0 ? <tr><td style={cell} colSpan={3}>none yet</td></tr> : stats.perMonth.map((m) => (
              <tr key={m.month}><td style={cell}>{m.month}</td><td style={cell}>{m.count}</td><td style={cell}>{usd(m.amount)}</td></tr>
            ))}</tbody></table>
        </section>
        <section style={section}>
          <h2 style={h2}>Paid after which message</h2>
          <table className="admin-table"><thead><tr><th style={head}>Messages sent before paying</th><th style={head}>Recovered</th></tr></thead>
            <tbody>{stats.paidAfterMessage.length === 0 ? <tr><td style={cell} colSpan={2}>none yet</td></tr> : stats.paidAfterMessage.map((m) => (
              <tr key={m.message}><td style={cell}>{m.message === 0 ? "0 (paid before message 1)" : `after message ${m.message}`}</td><td style={cell}>{m.count}</td></tr>
            ))}</tbody></table>
        </section>
        <section style={section}>
          <h2 style={h2}>Per channel</h2>
          <table className="admin-table"><thead><tr><th style={head}>Channel</th><th style={head}>Sent</th><th style={head}>Failed</th><th style={head}>Clicks</th><th style={head}>Clicked</th><th style={head}>Click rate</th><th style={head}>Replies</th></tr></thead>
            <tbody>{stats.perChannel.map((c) => (
              <tr key={c.channel}><td style={cell}>{c.label}</td><td style={cell}>{c.sent}</td><td style={cell}>{c.failed}</td><td style={cell}>{c.clicks}</td><td style={cell}>{c.clicked}</td><td style={cell}>{pct(c.clickRate)}</td><td style={cell}>{c.replies === null ? "see GHL" : c.replies}</td></tr>
            ))}</tbody></table>
          <p style={note}>Click rate = links clicked at least once / messages sent on that channel. Replies: Discord DM replies the hourly cron captured (posted to the mod channel); email and SMS replies are in GHL.</p>
        </section>
        <section style={section}>
          <h2 style={h2}>Per send time (Chicago)</h2>
          <table className="admin-table"><thead><tr><th style={head}>Slot</th><th style={head}>Sends</th><th style={head}>Clicks</th><th style={head}>Payments</th></tr></thead>
            <tbody>{stats.perSlot.map((s) => (
              <tr key={s.slot}><td style={cell}>{s.slot}</td><td style={cell}>{s.sends}</td><td style={cell}>{s.clicks}</td><td style={cell}>{s.payments}</td></tr>
            ))}</tbody></table>
          <p style={note}>10am = sent 10:00 to 13:59, 2pm = 14:00 to 17:59, 6pm = 18:00 hour. A payment counts for the slot of the last message before it was paid.</p>
        </section>
      </div>

      <section style={section}>
        <h2 style={h2}>Every sequence ({stats.sequences.length})</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th style={head}>User</th><th style={head}>Plan</th><th style={head}>Entered</th><th style={head}>Failed</th><th style={head}>Messages sent</th><th style={head}>Clicked</th><th style={head}>DM replies</th><th style={head}>Outcome</th><th style={head}>Paid</th><th style={head}>$</th>
            </tr></thead>
            <tbody>
              {stats.sequences.length === 0 ? (
                <tr><td style={cell} colSpan={10} className="admin-td-empty">No sequences in this range.</td></tr>
              ) : stats.sequences.map((s) => (
                <tr key={`${s.membershipId}-${s.failedAt ?? ""}`} className={s.outcome === "paid" ? undefined : s.outcome === "open" ? undefined : "admin-row-warn"}>
                  <td style={cell}><span className="admin-td-name">{s.username}</span></td>
                  <td style={cell}>{s.plan}</td>
                  <td style={cell}>{fmtDateTime(s.enteredAt)}</td>
                  <td style={cell}>{fmtDateTime(s.failedAt)}</td>
                  <td style={cell}>{s.messagesSent}</td>
                  <td style={cell}>{s.clicked ? `y (${s.clicks})` : "n"}</td>
                  <td style={cell}>{s.replies > 0 ? s.replies : "-"}</td>
                  <td style={cell} title={s.stopReason ?? ""}>{outcomeLabel(s.outcome)}</td>
                  <td style={cell}>{fmtDateTime(s.paidAt)}</td>
                  <td style={cell}>{s.amount !== null ? usd(s.amount) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
