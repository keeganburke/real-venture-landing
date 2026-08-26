"use client";

const KEEPS = [
  "Your streak, wins, and sprint progress",
  "Your saved deals and buyers",
  "Your Discord community role",
  "Your locked-in Pro pricing",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

type Props = {
  onAccept: () => void;
  onDecline: () => void;
};

export default function Gate2Pause({ onAccept, onDecline }: Props) {
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
