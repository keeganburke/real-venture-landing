"use client";

import QuestionShell from "./QuestionShell";

type Props = {
  question: {
    question: string;
    min: number;
    max: number;
    anchors: { position: number; label: string }[];
  };
  number: number;
  total: number;
  value: number | null;
  onChange: (n: number) => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

export default function QuestionScale({
  question, number, total, value, onChange, onBack, onNext, nextLabel,
}: Props) {
  const steps: number[] = [];
  for (let n = question.min; n <= question.max; n++) steps.push(n);

  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={value == null}
      nextLabel={nextLabel}
    >
      <div className="intake-scale">
        <div className="intake-scale-row" role="radiogroup" aria-label={question.question}>
          {steps.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              className={`intake-scale-dot${value === n ? " on" : ""}`}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="intake-scale-anchors">
          {question.anchors.map((a) => (
            <span key={a.position} className="intake-scale-anchor">
              <b>{a.position}</b> = {a.label}
            </span>
          ))}
        </div>
      </div>
    </QuestionShell>
  );
}
