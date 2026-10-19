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
};

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

export default function CancelFlow({ open, onClose, membershipId, plan, planId = null }: Props) {
  const [currentGate, setCurrentGate] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [, setSavedAt] = useState<number | null>(null);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  const track = useCancelTracking(sessionId, membershipId, plan);

  useEffect(() => {
    if (open) {
      setSessionId(crypto.randomUUID());
      setCurrentGate(0);
      setPausing(false);
      setPauseError(null);
    } else {
      setSessionId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !sessionId) return;
    track(GATE_OPEN_EVENTS[currentGate]);
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

  const handleReason = (reason: string) => {
    track("reason_selected", { reason });
    setCurrentGate(1);
  };

  // Awaited, and checked. This was fire-and-forget: the request was sent with
  // no await and no response check, and the modal closed claiming success
  // whatever came back. pause_accepted fired BEFORE the call, so it counted
  // intent rather than outcome and has been inflating the pause numbers.
  const handlePauseAccept = async () => {
    if (pausing) return;
    setPausing(true);
    setPauseError(null);

    try {
      const res = await fetch("/api/whop/pause", { method: "POST" });
      const data = await res.json().catch(() => null);

      // Both conditions: the route can answer 200 with { ok: false } when the
      // membership lookup fails, so res.ok alone is not enough.
      if (!res.ok || !data?.ok) {
        // 409 is "already paused" — a different situation from a failure, and
        // it needs a different sentence. Nothing is broken and retrying will
        // not help.
        const conflict = res.status === 409 || data?.whop_status === 409;
        track("pause_failed", {
          status: res.status,
          whop_status: data?.whop_status ?? null,
          error: typeof data?.error === "string" ? data.error : null,
          conflict,
        });
        setPauseError(
          conflict
            ? "This membership is already paused. Close this and check your plan status."
            : "We couldn't pause your membership. Please try again, or contact support at realventureestate@gmail.com."
        );
        setPausing(false);
        return;
      }

      // Only now is it true.
      track("pause_accepted", { pause_days: 14, resumes_at: data?.resumes_at ?? null });
      setPausing(false);
      saved("pause");
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

  return (
    <>
      <div className="cf-dim" onClick={onClose} />
      <div className="cf-modal">
        <div className="cf-modal-grabber" />
        <button className="cf-modal-close" onClick={onClose} aria-label="Close">
          {"×"}
        </button>

        {currentGate === 0 && (
          <Gate1Reason onReason={handleReason} onNeverMind={onClose} />
        )}
        {currentGate === 1 && (
          <Gate2Pause
            planId={planId}
            onAccept={handlePauseAccept}
            onDecline={handlePauseDecline}
            pausing={pausing}
            error={pauseError}
          />
        )}
        {currentGate === 2 && (
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
