"use client";

type Props = {
  onAccept: () => void;
  onDecline: () => void;
};

export default function Gate3FreeDays({ onAccept, onDecline }: Props) {
  return (
    <>
      <div className="cf-free-icn" />

      <div className="cf-modal-eyeb">Special offer, one time</div>
      <div className="cf-modal-h">Get 15 free days on us</div>
      <div className="cf-modal-sub">
        {"We really want you to close a deal. Take the next 15 days on our tab."}
      </div>

      <div className="cf-free-pitch">
        <div className="cf-free-pitch-h">Jump back into the sprint</div>
        <div className="cf-free-pitch-body">
          Most members hit their first contract by <b>Day 14</b>.{" "}
          {"That's exactly how long this offer lasts."}
        </div>
      </div>

      <button className="cf-btn-primary" onClick={onAccept}>
        Claim my 15 free days {"→"}
      </button>
      <button className="cf-btn-secondary" onClick={onDecline}>
        No thanks, continue
      </button>
    </>
  );
}
