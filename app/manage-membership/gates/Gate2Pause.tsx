"use client";

// The things a pause preserves. FLAT, not tier-aware: this list replaced a
// keepsFor(planId) helper that appended "Your locked-in Pro pricing" only for
// Pro and Ultra plan ids. "Locked-in pricing" is true on any plan — pausing
// holds whatever price you are on — so the branch was no longer earning its
// keep. Gate 2 was the ONLY tier-aware screen in the cancel flow; nothing is
// now. `planId` is still accepted so the call site is unchanged and the
// branch can come back without re-threading the prop.
const KEEPS = [
  "All 40 hours of live calls every week",
  "Coaches answering you in the chat",
  "The full Studio and every tool in it",
  "Your saved deals and buyer network",
  "Your Discord role and locked-in pricing",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

type Props = {
  /** Currently unused — see the KEEPS comment above. Kept on the type so the
   *  CancelFlow call site is untouched. */
  planId: string | null;
  onAccept: () => void;
  onDecline: () => void;
  /** True while the pause request is in flight. */
  pausing?: boolean;
  /** Set when the pause failed. The gate stays open so they can retry. */
  error?: string | null;
};

export default function Gate2Pause({
  onAccept,
  onDecline,
  pausing = false,
  error = null,
}: Props) {
  return (
    <>
      <div className="cf-pause-icn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      </div>

      <div className="cf-modal-eyeb">Need a break?</div>
      <div className="cf-modal-h">Take 14 days on us</div>
      <div className="cf-modal-sub">
        {"Your next payment moves back two weeks. Nothing else changes."}
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

      {/* Footer line sits between the list and the buttons, per the copy deck.
          No existing class fits (cf-modal-sub is the subheading, cf-foot-back
          is a link button), so it carries the muted/centred idiom inline. */}
      <p
        style={{
          margin: "0 0 14px",
          textAlign: "center",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--txt-dim)",
        }}
      >
        Most people quit two weeks before it clicks.
      </p>

      {/* Disabled + spinner while the request is in flight. CancelFlow also
          ignores a second click, so a double tap cannot send two pauses. */}
      <button
        className="cf-btn-primary blue"
        onClick={onAccept}
        disabled={pausing}
        aria-busy={pausing}
      >
        {pausing ? (
          <>
            <span className="cf-btn-spinner" aria-hidden="true" />
            {"Pausing\u2026"}
          </>
        ) : (
          "Push my payment 14 days"
        )}
      </button>
      <button className="cf-btn-secondary" onClick={onDecline} disabled={pausing}>
        No thanks, continue
      </button>

      {/* Failure keeps the member here rather than closing on a false
          success. The button above is the retry. */}
      {error && (
        <p
          role="alert"
          style={{
            marginTop: 12,
            textAlign: "center",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--red)",
          }}
        >
          {error}
        </p>
      )}
    </>
  );
}
