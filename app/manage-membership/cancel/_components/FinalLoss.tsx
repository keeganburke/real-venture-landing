"use client";

import { useState } from "react";
import Link from "next/link";
import TestimonialCard from "./TestimonialCard";
import { useFlowQuery } from "./CancelShell";

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

const CONFIRMED_PATH = "/manage-membership/cancel/confirmed";
const ERROR_COPY =
  "Something went wrong. Try again or email support at realventureestate@gmail.com.";

export default function FinalLoss() {
  const { href } = useFlowQuery();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = () => {
    setError(ERROR_COPY);
    setCancelling(false);
  };

  // Real Whop cancel: POST /api/whop/cancel (cookie auth, no body).
  // On success we hard-navigate to /confirmed so the flow state is fresh;
  // ends_at is only added when Whop returned one (URLSearchParams encodes it).
  const cancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/whop/cancel", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok !== true) {
        fail();
        return;
      }
      const extra: Record<string, string> = { action: "cancelled" };
      if (typeof data.ends_at === "string" && data.ends_at) extra.ends_at = data.ends_at;
      window.location.href = href(CONFIRMED_PATH, extra);
    } catch {
      fail();
    }
  };

  const label = cancelling ? "Cancelling..." : error ? "Try again" : "Cancel my membership";

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
        <Link href="/manage-membership" className="cancel-btn-primary">
          Keep my plan
        </Link>
        {error && (
          <p className="cancel-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="cancel-btn-quit"
          onClick={cancel}
          disabled={cancelling}
          aria-busy={cancelling}
        >
          {label}
        </button>
      </div>
    </>
  );
}
