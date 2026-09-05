"use client";

import QuestionShell from "./QuestionShell";

type Props = {
  question: { question: string; placeholder: string; minChars: number; required: boolean };
  number: number;
  total: number;
  value: string;
  onChange: (v: string) => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

export default function QuestionText({
  question, number, total, value, onChange, onBack, onNext, nextLabel,
}: Props) {
  const short = question.required && value.trim().length < question.minChars;

  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={short}
      nextLabel={nextLabel}
    >
      <div className="intake-text-wrap">
        <textarea
          className="intake-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={5}
        />
      </div>
    </QuestionShell>
  );
}
