"use client";

import QuestionShell from "./QuestionShell";
import type { IntakeOption } from "../intake-config";

type Props = {
  question: { question: string; subheading?: string; options: IntakeOption[] };
  number: number;
  total: number;
  value: string | null;
  onChange: (v: string) => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

export default function QuestionSingle({
  question, number, total, value, onChange, onBack, onNext, nextLabel,
}: Props) {
  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      subheading={question.subheading}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={value == null}
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
    </QuestionShell>
  );
}
