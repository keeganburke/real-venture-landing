"use client";

import QuestionShell from "./QuestionShell";
import type { IntakeOption } from "../intake-config";

type Props = {
  question: {
    question: string;
    subheading?: string;
    options: IntakeOption[];
    minSelections: number;
    textFollowup?: { prompt: string; placeholder: string };
  };
  number: number;
  total: number;
  value: string[];
  onChange: (v: string[]) => void;
  followupValue: string;
  onFollowupChange: (v: string) => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

export default function QuestionMulti({
  question, number, total, value, onChange,
  followupValue, onFollowupChange, onBack, onNext, nextLabel,
}: Props) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      subheading={question.subheading}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={value.length < question.minSelections}
      nextLabel={nextLabel}
    >
      <div className="intake-opts">
        {question.options.map((option) => {
          const on = value.includes(option.value);
          return (
            <button
              key={option.value}
              className={`intake-opt intake-opt-multi${on ? " on" : ""}`}
              onClick={() => toggle(option.value)}
              aria-pressed={on}
            >
              <span className={`intake-check${on ? " on" : ""}`} aria-hidden="true">
                {on ? "✓" : ""}
              </span>
              <span className="lbl">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Q3b rides on the same screen as Q3a. Optional -- no minimum. */}
      {question.textFollowup && (
        <div className="intake-followup">
          <label className="intake-followup-label">{question.textFollowup.prompt}</label>
          <textarea
            className="intake-textarea"
            value={followupValue}
            onChange={(e) => onFollowupChange(e.target.value)}
            placeholder={question.textFollowup.placeholder}
            rows={4}
          />
        </div>
      )}
    </QuestionShell>
  );
}
