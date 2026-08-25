"use client";

import type { IntakeQuestion } from "../intake-config";

type Props = {
  question: IntakeQuestion;
  number: number;
  total: number;
  selected: string | null | undefined;
  busy: boolean;
  onSelect: (value: string) => void;
  onBack?: () => void;
  onSkip: () => void;
  onNext: () => void;
};

export default function Question({
  question,
  number,
  total,
  selected,
  busy,
  onSelect,
  onBack,
  onSkip,
  onNext,
}: Props) {
  const percent = Math.round((number / total) * 100);
  const isLast = number === total;

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

      <div className="intake-q">{question.question}</div>

      <div className="intake-opts">
        {question.options.map((option) => (
          <button
            key={option.value}
            className={`intake-opt${selected === option.value ? " on" : ""}`}
            onClick={() => onSelect(option.value)}
            disabled={busy}
          >
            <svg
              className="ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: option.icon }}
            />
            <span className="lbl">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="intake-foot">
        <div className="foot-left">
          {onBack && (
            <button className="foot-back" onClick={onBack} disabled={busy}>
              {"← Back"}
            </button>
          )}
          <button className="foot-skip" onClick={onSkip} disabled={busy}>
            Skip
          </button>
        </div>
        <button
          className="foot-next"
          onClick={onNext}
          disabled={busy || selected == null}
        >
          {isLast ? "Finish →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
