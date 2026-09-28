"use client";

import QuestionShell from "./QuestionShell";

export type ScaleFollowup = {
  prompt: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
};

type Props = {
  question: { question: string; min: number; max: number; anchorLow: string; anchorHigh: string };
  number: number;
  total: number;
  value: number | null;
  onChange: (n: number) => void;
  // Branch follow-up rendered under the grid once a value is picked. The
  // client decides the copy from the value; this component only renders it.
  followup: ScaleFollowup | null;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

// 1-10 tap scale in two rows of five (1-5, then 6-10). Reuses the existing
// .intake-scale-dot styling for the buttons; the grid shape, tap-target
// height, and the selected fill are inline so no global CSS changes.
const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "8px",
};
const DOT: React.CSSProperties = { aspectRatio: "auto", minHeight: "56px", width: "100%" };
const DOT_ON: React.CSSProperties = {
  ...DOT,
  borderColor: "var(--gold, #E5B547)",
  background: "rgba(229, 181, 71, 0.16)",
  color: "var(--gold, #E5B547)",
};

export default function QuestionScaleTen({
  question, number, total, value, onChange, followup, onBack, onNext, nextLabel,
}: Props) {
  const steps: number[] = [];
  for (let n = question.min; n <= question.max; n++) steps.push(n);
  const rows = [steps.slice(0, 5), steps.slice(5)];

  const followupMissing = followup !== null && followup.value.trim().length === 0;
  const nextDisabled = value == null || followupMissing;

  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={nextDisabled}
      nextLabel={nextLabel}
    >
      <div className="intake-scale" role="radiogroup" aria-label={question.question}>
        {rows.map((row, i) => (
          <div key={i} style={{ ...GRID, marginTop: i === 0 ? 0 : 8 }}>
            {row.map((n) => {
              const on = value === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`intake-scale-dot${on ? " on" : ""}`}
                  style={on ? DOT_ON : DOT}
                  onClick={() => onChange(n)}
                >
                  {n}
                </button>
              );
            })}
          </div>
        ))}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            marginTop: "12px",
            fontSize: "13px",
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: "var(--txt-mut, rgba(255,255,255,.6))", flex: "0 0 auto" }}>
            {question.anchorLow}
          </span>
          <span
            style={{ color: "var(--gold, #E5B547)", fontWeight: 700, textAlign: "right", maxWidth: "62%" }}
          >
            {question.anchorHigh}
          </span>
        </div>

        {followup && (
          <div className="intake-followup">
            <label className="intake-followup-label">{followup.prompt}</label>
            {followup.hint && (
              <p
                style={{
                  margin: "-4px 0 10px",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--txt-mut, rgba(255,255,255,.6))",
                }}
              >
                {followup.hint}
              </p>
            )}
            <textarea
              className="intake-textarea"
              value={followup.value}
              onChange={(e) => followup.onChange(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
        )}
      </div>
    </QuestionShell>
  );
}
