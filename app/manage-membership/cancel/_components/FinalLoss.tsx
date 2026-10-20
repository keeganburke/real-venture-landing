"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TestimonialCard from "./TestimonialCard";
import { useCancelEvents } from "./CancelShell";

// Same list the old Gate4Loss shows.
const LOSS_FEATURES = [
  "Deal Analyzer",
  "Contract Generator",
  "Proof of Funds",
  "Buyer Network",
  "Live calls",
  "JV service",
  "Full curriculum",
  "Discord role",
  "All your progress",
  "Locked-in pricing",
];

// The last step does not call Whop. Members manage the plan on whop.com
// themselves; we log the hand-off and send them there.
const WHOP_URL = "https://whop.com";

export default function FinalLoss() {
  const router = useRouter();
  const { logOnce } = useCancelEvents();
  const [leaving, setLeaving] = useState(false);

  const keepPlan = () => {
    void logOnce("kept_plan");
    router.push("/manage-membership");
  };

  // Log first (bounded by the helper's timeout, never throws), then redirect.
  // `leaving` disables the button so a double click cannot double-log.
  const cancel = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await logOnce("redirected_to_whop");
    } catch {}
    window.location.href = WHOP_URL;
  };

  return (
    <>
      <div className="loss-grid">
        {LOSS_FEATURES.map((f) => (
          <div key={f} className="loss-item">
            <span className="loss-x" aria-hidden="true">{"×"}</span>
            <span>{f}</span>
          </div>
        ))}
      </div>

      <TestimonialCard />

      <div className="cancel-continue">
        <button type="button" className="cancel-btn-primary" onClick={keepPlan}>
          Keep my plan
        </button>
        <button
          type="button"
          className="cancel-btn-quit"
          onClick={() => void cancel()}
          disabled={leaving}
          aria-busy={leaving}
        >
          {leaving ? "Taking you to Whop..." : "Cancel my membership"}
        </button>
      </div>
    </>
  );
}
