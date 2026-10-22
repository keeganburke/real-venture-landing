import { createAdminClient } from "./supabase/admin";
import { manageAuthHeaders } from "./whop-manage";
import { PAUSE_SUCCEEDED_EVENT } from "../app/api/whop/pause-state";
import { postToModChannel } from "./discord-kick";
import { listPausedMemberships } from "./whop-paused";

// Safety net for the 14-day pause. The cancel flow sends resumes_at to Whop,
// but Whop never returns it and the only record is our pause_succeeded event,
// so this cron re-checks: any membership Whop still lists as paused whose
// recorded resume date passed more than RESUME_GRACE_MS ago gets resumed via
// the documented endpoint
//   POST /api/v1/memberships/{id}/resume   (no body; scopes member:manage,
//   member:email:read, member:basic:read; "Resume a previously paused
//   membership's recurring payments. Billing resumes on the next cycle.")
//   https://docs.whop.com/api-reference/memberships/resume-membership
// Memberships with NO pause_succeeded event are never touched: those were
// paused by hand in the Whop dashboard (coach comps) and stay as they are.
// Mode: PAUSE_RESUME_MODE === "live" resumes; anything else is shadow (log +
// mod post only). Every resume, shadow or live, is written to
// cancel_flow_events as pause_resumed_by_cron.

const WHOP_API = "https://api.whop.com/api/v1";
export const RESUME_GRACE_MS = 24 * 60 * 60 * 1000;
export const PAUSE_RESUMED_EVENT = "pause_resumed_by_cron";

export type ResumeMode = "shadow" | "live";
export function resumeMode(): ResumeMode {
  return process.env.PAUSE_RESUME_MODE === "live" ? "live" : "shadow";
}

type PauseRecord = { membershipId: string; userId: string; pausedAt: string; resumesAt: string | null };

// Latest pause_succeeded per membership id, plus whether a pause_resumed_by_cron
// (live) already followed it.
async function loadPauseRecords(membershipIds: string[]): Promise<
  | { ok: true; latest: Map<string, PauseRecord>; resumedAfter: Set<string> }
  | { ok: false; error: string }
> {
  const latest = new Map<string, PauseRecord>();
  const resumedAfter = new Set<string>();
  if (membershipIds.length === 0) return { ok: true, latest, resumedAfter };
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cancel_flow_events")
      .select("membership_id, user_id, event_type, event_data, created_at")
      .in("membership_id", membershipIds)
      .in("event_type", [PAUSE_SUCCEEDED_EVENT, PAUSE_RESUMED_EVENT])
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: `events read failed: ${error.message}` };
    for (const e of data ?? []) {
      const mid = typeof e.membership_id === "string" ? e.membership_id : null;
      if (!mid) continue;
      const ed = e.event_data && typeof e.event_data === "object" ? (e.event_data as Record<string, unknown>) : {};
      if (e.event_type === PAUSE_SUCCEEDED_EVENT) {
        const resumesAt = typeof ed.resumes_at === "string" && !Number.isNaN(Date.parse(ed.resumes_at)) ? ed.resumes_at : null;
        latest.set(mid, { membershipId: mid, userId: String(e.user_id), pausedAt: String(e.created_at), resumesAt });
        resumedAfter.delete(mid); // a newer pause supersedes any earlier resume
      } else if (e.event_type === PAUSE_RESUMED_EVENT && ed.mode === "live" && ed.ok === true) {
        if (latest.has(mid)) resumedAfter.add(mid);
      }
    }
    return { ok: true, latest, resumedAfter };
  } catch (err) {
    return { ok: false, error: `events read threw: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export type ResumeOutcome = {
  membershipId: string;
  userId: string;
  resumesAt: string;
  action: "would_resume" | "resumed" | "failed";
  whopStatus: number | null;
  error: string | null;
};

export type ResumeSummary = {
  mode: ResumeMode;
  paused: number;          // memberships Whop lists as paused
  withRecord: number;      // of those, with a pause_succeeded event
  due: number;             // resume date passed more than 24 h ago
  skippedHandPaused: number;
  skippedAlreadyResumed: number;
  skippedNotDue: number;
  outcomes: ResumeOutcome[];
  aborted: string | null;
};

async function resumeOnWhop(membershipId: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${WHOP_API}/memberships/${membershipId}/resume`, {
    method: "POST",
    headers: { ...manageAuthHeaders(), "Idempotency-Key": crypto.randomUUID() },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function logResume(o: ResumeOutcome, mode: ResumeMode): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("cancel_flow_events").insert({
      user_id: o.userId,
      membership_id: o.membershipId,
      session_id: crypto.randomUUID(),
      plan: null,
      event_type: PAUSE_RESUMED_EVENT,
      event_data: {
        mode,
        ok: o.action === "resumed",
        action: o.action,
        resumes_at: o.resumesAt,
        whop_status: o.whopStatus,
        error: o.error,
      },
    });
    if (error) console.error("[pause-resume] event insert failed", error.message);
  } catch (err) {
    console.error("[pause-resume] event insert threw", err);
  }
}

function formatSummary(s: ResumeSummary): string {
  const lines = [
    `**Pause resume check** | mode **${s.mode}** | paused on Whop ${s.paused} | with pause_succeeded ${s.withRecord} | due ${s.due}`,
  ];
  if (s.aborted) lines.push(`ALERT: ${s.aborted}. Acted on no one.`);
  for (const o of s.outcomes) {
    lines.push(`${o.action}: ${o.membershipId} (user ${o.userId}) resume date ${o.resumesAt.slice(0, 10)}${o.whopStatus !== null ? ` | whop ${o.whopStatus}` : ""}${o.error ? ` | ${o.error}` : ""}`);
  }
  lines.push(`skipped: hand-paused (no event) ${s.skippedHandPaused} | already resumed ${s.skippedAlreadyResumed} | not due yet ${s.skippedNotDue}`);
  return lines.join("\n");
}

export async function runPauseResume(now: number = Date.now()): Promise<ResumeSummary> {
  const mode = resumeMode();
  const summary: ResumeSummary = {
    mode, paused: 0, withRecord: 0, due: 0,
    skippedHandPaused: 0, skippedAlreadyResumed: 0, skippedNotDue: 0,
    outcomes: [], aborted: null,
  };
  try {
    const listed = await listPausedMemberships();
    if (!listed.ok) {
      summary.aborted = `Whop paused list failed: ${listed.error}`;
      await postToModChannel(formatSummary(summary));
      return summary;
    }
    summary.paused = listed.rows.length;
    const ids = listed.rows.map((m) => String(m.id));
    const records = await loadPauseRecords(ids);
    if (!records.ok) {
      summary.aborted = `Supabase read failed: ${records.error}`;
      await postToModChannel(formatSummary(summary));
      return summary;
    }

    const due: PauseRecord[] = [];
    for (const m of listed.rows) {
      const rec = records.latest.get(String(m.id));
      if (!rec) {
        summary.skippedHandPaused++;
        continue;
      }
      summary.withRecord++;
      if (records.resumedAfter.has(rec.membershipId)) {
        summary.skippedAlreadyResumed++;
        continue;
      }
      if (!rec.resumesAt || Date.parse(rec.resumesAt) > now - RESUME_GRACE_MS) {
        summary.skippedNotDue++;
        continue;
      }
      due.push(rec);
    }
    summary.due = due.length;

    for (const rec of due) {
      const o: ResumeOutcome = {
        membershipId: rec.membershipId,
        userId: rec.userId,
        resumesAt: rec.resumesAt ?? "",
        action: "would_resume",
        whopStatus: null,
        error: null,
      };
      if (mode === "live") {
        try {
          const r = await resumeOnWhop(rec.membershipId);
          o.whopStatus = r.status;
          if (r.status >= 200 && r.status < 300) {
            o.action = "resumed";
          } else {
            o.action = "failed";
            o.error = r.body.slice(0, 300);
            console.error("[pause-resume] whop resume failed", rec.membershipId, r.status, r.body.slice(0, 2000));
          }
        } catch (err) {
          o.action = "failed";
          o.error = err instanceof Error ? err.message : "unknown";
        }
      }
      summary.outcomes.push(o);
      await logResume(o, mode);
    }

    await postToModChannel(formatSummary(summary));
    return summary;
  } catch (err) {
    summary.aborted = `threw: ${err instanceof Error ? err.message : "unknown"}`;
    await postToModChannel(formatSummary(summary));
    return summary;
  }
}
