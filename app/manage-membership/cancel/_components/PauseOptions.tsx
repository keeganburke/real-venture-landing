"use client";

import { useRouter } from "next/navigation";
import ContinueLink from "./ContinueLink";
import { useFlowQuery } from "./CancelShell";

const OPTIONS = [
  { days: 30, sub: "for a quick break" },
  { days: 60, sub: "for a real reset" },
  { days: 90, sub: "for a full break" },
];

// Tier-neutral for now; the Pro pricing line returns once planId is
// threaded through in a later prompt.
const KEEPS = [
  "Your streak and wins",
  "Your saved deals and buyers",
  "Your Discord community role",
];

export default function PauseOptions() {
  const router = useRouter();
  const { href } = useFlowQuery();

  // No API call yet: the pause itself is wired in a later prompt.
  const choose = (days: number) =>
    router.push(href("/manage-membership/cancel/confirmed", { action: "paused", days: String(days) }));

  return (
    <>
      <div className="pause-cards">
        {OPTIONS.map((o) => (
          <button key={o.days} type="button" className="pause-card" onClick={() => choose(o.days)}>
            <span className="pause-card-num">{o.days}</span>
            <span className="pause-card-text">
              <span className="pause-card-label">days</span>
              <span className="pause-card-sub">{o.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="keeps-block">
        <div className="keeps-h">You keep everything</div>
        <div className="keeps-list">
          {KEEPS.map((k) => (
            <div key={k} className="keeps-item">
              <span className="keeps-check" aria-hidden="true">{"✓"}</span>
              <span>{k}</span>
            </div>
          ))}
        </div>
      </div>

      <ContinueLink secondary={{ label: "No thanks, continue", to: "/manage-membership/cancel/final" }} />
    </>
  );
}
