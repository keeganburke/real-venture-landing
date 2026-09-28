"use client";

import QuestionShell from "./QuestionShell";

export type ScaleFollowup = {
  prompt: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
};

type Props = {
  // anchorLow / anchorHigh still arrive from intake-config but are not
  // rendered: the copy below is the source of truth for this screen.
  question: { question: string; min: number; max: number; anchorLow: string; anchorHigh: string };
  number: number;
  total: number;
  value: number | null;
  onChange: (n: number) => void;
  // Optional follow-up rendered under the anchors once a value is picked. The
  // client decides the copy from the value; this component only renders it.
  // It never blocks Next.
  followup: ScaleFollowup | null;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
};

// Helper line shown as the subheading (existing .intake-sub style) above the
// grid. The two anchors sit next to the numbers they describe: the low one
// above the grid over the 1/2 cells in red, the high one below it under 9/10
// in green (.intake-scale-anchor-red / -green in globals.css).
const INSTRUCTION = "Answering honestly helps us customize your experience.";
const ANCHOR_LOW = "1 = just browsing around";
const ANCHOR_HIGH = "10 = 100% dedicated";

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
// Anchor lines: plain block text, one above the grid (left) and one below it
// (right), with breathing room from the buttons. Colour/weight come from the
// shared .intake-scale-anchor-red / .intake-scale-anchor-green classes.
const ANCHOR_BASE: React.CSSProperties = { fontSize: "13.5px", lineHeight: 1.5 };
const ANCHOR_ABOVE: React.CSSProperties = { ...ANCHOR_BASE, textAlign: "left", margin: "0 0 12px" };
const ANCHOR_BELOW: React.CSSProperties = { ...ANCHOR_BASE, textAlign: "right", margin: "12px 0 0" };

export default function QuestionScaleTen({
  question, number, total, value, onChange, followup, onBack, onNext, nextLabel,
}: Props) {
  const steps: number[] = [];
  for (let n = question.min; n <= question.max; n++) steps.push(n);
  const rows = [steps.slice(0, 5), steps.slice(5)];

  return (
    <QuestionShell
      number={number}
      total={total}
      question={question.question}
      subheading={INSTRUCTION}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={value == null}
      nextLabel={nextLabel}
    >
      <div className="intake-scale" role="radiogroup" aria-label={question.question}>
        <div className="intake-scale-anchor-red" style={ANCHOR_ABOVE} aria-hidden="true">
          {ANCHOR_LOW}
        </div>

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

        <div className="intake-scale-anchor-green" style={ANCHOR_BELOW} aria-hidden="true">
          {ANCHOR_HIGH}
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
                  color: "#fff",
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
