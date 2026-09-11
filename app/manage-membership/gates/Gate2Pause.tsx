"use client";

const PRO_PLAN_IDS = new Set([
  "plan_J8vFpCWME75W3",   // Pro monthly
  "plan_9nyRNbuhQF0pk",   // Pro 3-month
  "plan_SIYHeHyFp1dbR",   // legacy Pro
  "plan_mjpuBNS3KJqmw",   // Ultra monthly, $249.99
]);

// Tier-aware "you keep" list. Sprint progress is not persisted anywhere, so
// it is not promised; "locked-in Pro pricing" only applies to Pro plans.
function keepsFor(planId: string | null): string[] {
  const isPro = planId ? PRO_PLAN_IDS.has(planId) : false;
  const base = [
    "Your streak and wins",
    "Your saved deals and buyers",
    "Your Discord community role",
  ];
  if (isPro) base.push("Your locked-in Pro pricing");
  return base;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

type Props = {
  planId: string | null;
  onAccept: () => void;
  onDecline: () => void;
};

export default function Gate2Pause({ planId, onAccept, onDecline }: Props) {
  const KEEPS = keepsFor(planId);
  return (
    <>
      <div className="cf-pause-icn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      </div>

      <div className="cf-modal-eyeb">Need a break?</div>
      <div className="cf-modal-h">Pause instead</div>
      <div className="cf-modal-sub">
        {"We'll still be here when you're ready to come back. Freeze your membership for 30 days, free."}
      </div>

      <div className="cf-pause-keeps">
        <div className="cf-pause-keeps-h">You keep everything</div>
        <div className="cf-pause-keeps-list">
          {KEEPS.map((item) => (
            <div className="cf-pause-keep" key={item}>
              <span className="cf-pause-keep-check">
                <CheckIcon />
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="cf-btn-primary blue" onClick={onAccept}>
        Pause for 30 days
      </button>
      <button className="cf-btn-secondary" onClick={onDecline}>
        No thanks, continue
      </button>
    </>
  );
}
