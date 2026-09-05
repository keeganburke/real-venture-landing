"use client";

import QuestionShell from "./QuestionShell";
import type { IntakeOption } from "../intake-config";

type Props = {
  question: {
    question: string;
    options: IntakeOption[];
    otherValue: string;
    otherFollowup: { label: string };
  };
  number: number;
  total: number;
  value: string | null;
  onChange: (v: string) => void;
  otherText: string;
  onOtherTextChange: (v: string) => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

export default function QuestionSingleOther({
  question, number, total, value, onChange,
  otherText, onOtherTextChange, onBack, onNext, nextLabel,
}: Props) {
  const isOther = value === question.otherValue;
  const blocked = value == null || (isOther && otherText.trim().length === 0);

  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={blocked}
      nextLabel={nextLabel}
    >
      <div className="intake-opts">
        {question.options.map((option) => (
          <button
            key={option.value}
            className={`intake-opt${value === option.value ? " on" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <span className="lbl">{option.label}</span>
          </button>
        ))}
      </div>

      {/* Revealed only when "Something else" is picked; then it is required. */}
      {isOther && (
        <div className="intake-followup">
          <label className="intake-followup-label">{question.otherFollowup.label}</label>
          <textarea
            className="intake-textarea"
            value={otherText}
            onChange={(e) => onOtherTextChange(e.target.value)}
            rows={3}
            autoFocus
          />
        </div>
      )}
    </QuestionShell>
  );
}
