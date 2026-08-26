"use client";

import { useCallback, useEffect, useState } from "react";
import Gate1Reason from "./gates/Gate1Reason";
import Gate2Pause from "./gates/Gate2Pause";
import Gate3FreeDays from "./gates/Gate3FreeDays";
import Gate4Loss from "./gates/Gate4Loss";

type Props = {
  open: boolean;
  onClose: () => void;
  membershipId: string;
  plan: string;
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

// Events fired when each gate renders. Gate 5 is not a gate component, it is
// the redirect fired from Gate 4's quit handler.
const GATE_OPEN_EVENTS = [
  "cancel_flow_started",
  "pause_offered",
  "free_days_offered",
  "loss_screen_viewed",
];

export default function CancelFlow({ open, onClose, membershipId, plan }: Props) {
  const [currentGate, setCurrentGate] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [, setSavedAt] = useState<number | null>(null);

  const track = useCancelTracking(sessionId, membershipId, plan);

  useEffect(() => {
    if (open) {
      setSessionId(crypto.randomUUID());
      setCurrentGate(0);
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

  const handlePauseAccept = () => {
    track("pause_accepted", { pause_days: 30 });
    fetch("/api/whop/pause", { method: "POST" });
    saved("pause");
  };

  const handlePauseDecline = () => {
    track("pause_declined");
    setCurrentGate(2);
  };

  const handleFreeDaysAccept = () => {
    track("free_days_accepted", { days: 15 });
    fetch("/api/whop/add-free-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 15 }),
    });
    saved("free_days");
  };

  const handleFreeDaysDecline = () => {
    track("free_days_declined");
    setCurrentGate(3);
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
          <Gate2Pause onAccept={handlePauseAccept} onDecline={handlePauseDecline} />
        )}
        {currentGate === 2 && (
          <Gate3FreeDays onAccept={handleFreeDaysAccept} onDecline={handleFreeDaysDecline} />
        )}
        {currentGate === 3 && (
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
