"use client";

import QuestionShell from "./QuestionShell";

type Props = {
  question: { question: string; subheading: string; placeholder: string };
  number: number;
  total: number;
  value: string;
  onChange: (v: string) => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

// Digits only, for the "looks like a phone" check; formatting is kept as typed.
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Optional question: an empty field can always advance (saved as null).
// A partial number blocks Next until it has at least 10 digits.
export default function QuestionPhone({
  question, number, total, value, onChange, onBack, onNext, nextLabel,
}: Props) {
  const digits = phoneDigits(value);
  const partial = value.trim() !== "" && digits.length < 10;

  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      subheading={question.subheading}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={partial}
      nextLabel={nextLabel}
    >
      <div className="intake-text-wrap">
        <input
          className="intake-textarea intake-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          maxLength={30}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
        />
        {partial && (
          <p className="intake-phone-hint">Enter at least 10 digits, or leave it blank to skip.</p>
        )}
      </div>
    </QuestionShell>
  );
}
