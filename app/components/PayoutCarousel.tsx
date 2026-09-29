"use client";

import { useEffect, useState } from "react";
import { PAYOUTS, type Payout } from "@/lib/payouts";

// Auto-scroll payout marquee. Data comes from lib/payouts.ts (single source
// of truth); the list renders twice so the -50% keyframe loops seamlessly.
// Clicking a card opens a modal with the full screenshot and story; the
// marquee pauses while it is open and Escape closes it.
export default function PayoutCarousel() {
  const [open, setOpen] = useState<Payout | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="lp-payout-marquee">
        <div className={`lp-payout-track${open ? " is-paused" : ""}`}>
          {[...PAYOUTS, ...PAYOUTS].map((payout, idx) => (
            <article
              className="payout-card"
              key={`${payout.id}-${idx}`}
              role="button"
              tabIndex={0}
              aria-label={`Open ${payout.name}'s ${payout.amount} payout`}
              onClick={() => setOpen(payout)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(payout);
                }
              }}
            >
              <div className="payout-screenshot">
                <img src={payout.screenshot} alt={payout.screenshotAlt} />
              </div>
              <div className="payout-meta">
                <img className="payout-avatar" src={payout.avatar} alt="" />
                <div className="payout-meta-text">
                  <div className="payout-name">
                    {payout.name}, <span className="payout-age">{payout.age}</span>
                  </div>
                </div>
                <div className="payout-amount">{payout.amount}</div>
              </div>
              <p className="payout-blurb">{payout.blurb}</p>
            </article>
          ))}
        </div>
      </div>

      {open && (
        <div className="payout-modal-overlay" onClick={() => setOpen(null)}>
          <div
            className="payout-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${open.name}, ${open.age}: ${open.amount} payout`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="payout-modal-close"
              aria-label="Close"
              onClick={() => setOpen(null)}
            >
              {"×"}
            </button>
            <img className="payout-modal-screenshot" src={open.screenshot} alt={open.screenshotAlt} />
            <div className="payout-modal-meta">
              <img className="payout-modal-avatar" src={open.avatar} alt="" />
              <div>
                <div className="payout-modal-name">
                  {open.name}, {open.age}
                </div>
                <div className="payout-modal-amount">{open.amount}</div>
              </div>
            </div>
            <p className="payout-modal-blurb">{open.blurb}</p>
          </div>
        </div>
      )}
    </>
  );
}
