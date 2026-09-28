"use client";

import QuestionShell from "./QuestionShell";

type Props = {
  question: { question: string; subheading?: string; placeholder: string };
  number: number;
  total: number;
  // Digit string ("" when empty); the client converts to a number on advance.
  value: string;
  onChange: (v: string) => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

// Integer input (age). Mirrors QuestionText's shell and input styling; text
// input with a numeric keypad instead of type=number, which shows spinner
// arrows on desktop and misbehaves on iOS. Non-digits are stripped on change.
// No range check: any non-empty digit string enables Next.
export default function QuestionNumber({
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
      nextDisabled={value === ""}
      nextLabel={nextLabel}
    >
      <div className="intake-text-wrap">
        <input
          className="intake-textarea intake-phone"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          maxLength={3}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder={question.placeholder}
        />
      </div>
    </QuestionShell>
  );
}
