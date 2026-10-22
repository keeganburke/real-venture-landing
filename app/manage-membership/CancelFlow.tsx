"use client";

import { useCallback, useEffect, useState } from "react";
import Gate1Reason from "./gates/Gate1Reason";
import Gate2Pause from "./gates/Gate2Pause";
import Gate4Loss from "./gates/Gate4Loss";

type Props = {
  open: boolean;
  onClose: () => void;
  membershipId: string;
  plan: string;
  // Whop plan id, for tier-aware gate copy. Optional so the existing
  // ManageMembershipClient call site keeps compiling; null = unknown tier.
  planId?: string | null;
  // False when Gate 2 must not be offered: the membership is already paused,
  // a pause was used in the last 180 days, or there is no subscription to
  // pause. Decided server side (pause-state.ts) and passed down by page.tsx.
  pausable?: boolean;
  // Why pausable is false, for the pause_skipped event. null = unknown.
  pauseBlock?: string | null;
};

// "Nov 21, 2026" from an ISO date-time; null when it does not parse.
function formatDate(iso: string | null | undefined): string | null {
  if (typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Refusal codes from /api/whop/pause, each with its own sentence. Anything
// else is a real failure and keeps the generic retry copy.
function refusalCopy(code: string | null, resumes: string | null): string | null {
  switch (code) {
    case "already_paused":
      return resumes
        ? `This membership is already paused until ${resumes}.`
        : "This membership is already paused. Close this and check your plan status.";
    case "already_used":
      return "You've already used a pause in the last 6 months, so this one isn't available yet.";
    case "no_subscription":
      return "This membership has no billing to pause (free or complimentary access).";
    default:
      return null;
  }
}

// Fire and forget tracking. No await, no error handling; keepalive so events
// fired right before the Gate 5 redirect still make it out.
function useCancelTracking(sessionId: string | null, membershipId: string, plan: string) {
  return useCallback(
    (eventType: string, eventData?: Record<string, unknown>) => {
      if (!sessionId) return;
      try {
        fetch("/api/cancel-events/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            event_type: eventType,
            session_id: sessionId,
            membership_id: membershipId || null,
            plan,
            event_data: eventData ?? null,
          }),
        });
      } catch {
        // never blocks UI
      }
    },
    [sessionId, membershipId, plan]
  );
}

// Events fired when each gate renders, indexed by gate number.
//
// The 15-free-days gate was removed from the flow; the sequence is now
// reason -> pause -> loss. Its component (gates/Gate3FreeDays.tsx), its route
// (app/api/whop/add-free-days/route.ts) and its migration all remain on disk,
// unreferenced, so the offer can be restored without rebuilding it. The
// free_days_* event types stay whitelisted in cancel-events/log because
// historical rows carry them.
const GATE_OPEN_EVENTS = [
  "cancel_flow_started",
  "pause_offered",
  "loss_screen_viewed",
];

export default function CancelFlow({
  open,
  onClose,
  membershipId,
  plan,
  planId = null,
  pausable = true,
  pauseBlock = null,
}: Props) {
  const [currentGate, setCurrentGate] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [, setSavedAt] = useState<number | null>(null);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  // Set after Whop accepted the pause; renders the success step in place of
  // the gates. resumesAt is the 14-day date we sent to Whop (stored in the
  // pause_succeeded event; Whop does not return it).
  const [pauseDone, setPauseDone] = useState<{ resumesAt: string | null } | null>(null);

  const track = useCancelTracking(sessionId, membershipId, plan);

  useEffect(() => {
    if (open) {
      setSessionId(crypto.randomUUID());
      setCurrentGate(0);
      setPausing(false);
      setPauseError(null);
      setPauseDone(null);
    } else {
      setSessionId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !sessionId) return;
    const eventType = GATE_OPEN_EVENTS[currentGate];
    if (eventType) track(eventType);
  }, [open, sessionId, currentGate, track]);

  // Scroll lock while the sheet is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const saved = (gate: string) => {
    setSavedAt(Date.now());
    track("saved", { gate });
    onClose();
  };

  // After a confirmed pause the page's status line is stale (it was rendered
  // before the pause), so closing reloads /manage-membership instead of just
  // hiding the sheet.
  const closeAfterPause = () => {
    onClose();
    window.location.reload();
  };

  const handleReason = (reason: string) => {
    track("reason_selected", { reason });
    if (!pausable) {
      // Gate 2 is skipped: already paused, pause used recently, or nothing to
      // pause. Straight to the loss screen.
      track("pause_skipped", { reason: pauseBlock });
      setCurrentGate(2);
      return;
    }
    setCurrentGate(1);
  };

  // Awaited, and checked. This was fire-and-forget: the request was sent with
  // no await and no response check, and the modal closed claiming success
  // whatever came back. pause_accepted fired BEFORE the call, so it counted
  // intent rather than outcome and has been inflating the pause numbers.
  //
  // Double clicks: `pausing` is checked first and the button is disabled while
  // it is true, so one request per accept at most. The server refuses an
  // already-paused or recently-paused membership without calling Whop.
  const handlePauseAccept = async () => {
    if (pausing || pauseDone) return;
    setPausing(true);
    setPauseError(null);

    try {
      const res = await fetch("/api/whop/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, plan }),
      });
      const data = await res.json().catch(() => null);

      // Both conditions: the route can answer 200 with { ok: false } when the
      // membership lookup fails, so res.ok alone is not enough.
      if (!res.ok || !data?.ok) {
        const code = typeof data?.error === "string" ? data.error : null;
        // Whop's own 409 and the route's already_paused refusal are the same
        // situation: nothing is broken and retrying will not help.
        const conflict = res.status === 409 || data?.whop_status === 409 || code === "already_paused";
        track("pause_failed", {
          status: res.status,
          whop_status: data?.whop_status ?? null,
          error: code,
          conflict,
        });
        const specific = refusalCopy(code, formatDate(data?.resumes));
        setPauseError(
          specific ??
            (conflict
              ? "This membership is already paused. Close this and check your plan status."
              : "We couldn't pause your membership. Please try again, or contact support at realventureestate@gmail.com.")
        );
        setPausing(false);
        return;
      }

      // Only now is it true. resumes_at is what we asked for; next_payment_at
      // is what Whop shows. Both are kept so the two can be compared later.
      track("pause_accepted", {
        pause_days: 14,
        resumes_at: data?.resumes_at ?? null,
        next_payment_at: data?.next_payment_at ?? null,
        paused_confirmed: data?.paused_confirmed ?? null,
      });
      track("saved", { gate: "pause" });
      setSavedAt(Date.now());
      setPausing(false);
      setPauseDone({ resumesAt: typeof data?.resumes_at === "string" ? data.resumes_at : null });
    } catch {
      track("pause_failed", { status: null, whop_status: null, error: "network", conflict: false });
      setPauseError(
        "We couldn't reach the server. Please check your connection and try again."
      );
      setPausing(false);
    }
  };

  const handlePauseDecline = () => {
    track("pause_declined");
    setCurrentGate(2);
  };

  const handleKeep = () => {
    track("kept_plan");
    saved("kept_plan");
  };

  const handleProceedToCancel = () => {
    track("proceeded_to_cancel");
    track("redirected_to_whop");
  };

  const close = pauseDone ? closeAfterPause : onClose;
  const resumeLabel = pauseDone ? formatDate(pauseDone.resumesAt) : null;

  return (
    <>
      <div className="cf-dim" onClick={close} />
      <div className="cf-modal">
        <div className="cf-modal-grabber" />
        <button className="cf-modal-close" onClick={close} aria-label="Close">
          {"×"}
        </button>

        {pauseDone && (
          <>
            <div className="cf-pause-done-icn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="cf-modal-eyeb">Done</div>
            <div className="cf-modal-h">{"You're paused."}</div>
            <div className="cf-modal-sub">
              {resumeLabel
                ? `You won't be charged until ${resumeLabel}. You keep full access.`
                : "You won't be charged while paused. You keep full access."}
            </div>
            <a className="cf-btn-primary link" href="/dashboard">
              Back to my dashboard
            </a>
          </>
        )}

        {!pauseDone && currentGate === 0 && (
          <Gate1Reason onReason={handleReason} onNeverMind={onClose} />
        )}
        {!pauseDone && currentGate === 1 && (
          <Gate2Pause
            planId={planId}
            onAccept={handlePauseAccept}
            onDecline={handlePauseDecline}
            pausing={pausing}
            error={pauseError}
          />
        )}
        {!pauseDone && currentGate === 2 && (
          <Gate4Loss
            onKeep={handleKeep}
            onTestimonialShown={(testimonialId, index) =>
              track("testimonial_shown", { testimonial_id: testimonialId, index })
            }
            onProceedToCancel={handleProceedToCancel}
          />
        )}
      </div>
    </>
  );
}
