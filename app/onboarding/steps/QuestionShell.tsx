"use client";

import type { ReactNode } from "react";

// Shared chrome for every question screen: progress bar, prompt, body slot,
// footer. Every question in the new flow is required, so there is no way
// to bypass one.
export default function QuestionShell({
  number,
  total,
  question,
  subheading,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  number: number;
  total: number;
  question: string;
  subheading?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
}) {
  const percent = Math.round((number / total) * 100);
  return (
    <div className="intake">
      <div className="intake-progress">
        <div className="meta">
          <span>{`Question ${number} of ${total}`}</span>
          <span>{`${percent}%`}</span>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="intake-q">{question}</div>
      {subheading && <div className="intake-sub">{subheading}</div>}

      {children}

      <div className="intake-foot">
        <div className="foot-left">
          {onBack && (
            <button className="foot-back" onClick={onBack}>
              {"← Back"}
            </button>
          )}
        </div>
        <button className="foot-next" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
