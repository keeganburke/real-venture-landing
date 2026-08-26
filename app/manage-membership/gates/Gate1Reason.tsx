"use client";

import { useState } from "react";

const REASONS: { value: string; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using", label: "Not using it enough" },
  { value: "no_results", label: "Haven't closed a deal yet" },
  { value: "found_elsewhere", label: "Found something else" },
  { value: "other", label: "Other" },
];

type Props = {
  onReason: (reason: string) => void;
  onNeverMind: () => void;
};

export default function Gate1Reason({ onReason, onNeverMind }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="cf-modal-eyeb">Before you cancel</div>
      <div className="cf-modal-h">{"What's the main reason?"}</div>
      <div className="cf-modal-sub">
        {"We're always trying to get better. This helps us know what's not landing."}
      </div>

      <div className="cf-reason-opts">
        {REASONS.map((reason) => (
          <button
            key={reason.value}
            className={`cf-reason-opt${selected === reason.value ? " on" : ""}`}
            onClick={() => {
              setSelected(reason.value);
              onReason(reason.value);
            }}
          >
            {reason.label}
          </button>
        ))}
      </div>

      <div className="cf-modal-foot">
        <button className="cf-foot-back" onClick={onNeverMind}>
          Never mind, keep my plan
        </button>
      </div>
    </>
  );
}
