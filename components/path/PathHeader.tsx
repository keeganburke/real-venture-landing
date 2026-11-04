// Simple header for the path preview. "Your Path" title, "Step X of 7"
// counter, and a thin gold progress bar. currentStep is clamped by the caller
// so this component never sees an out-of-range value.

import { TOTAL_STEPS } from "@/lib/path/steps";

type Props = {
  /** 1..TOTAL_STEPS+1. Values > TOTAL_STEPS mean "all steps complete". */
  currentStep: number;
};

export default function PathHeader({ currentStep }: Props) {
  const completed = Math.min(Math.max(currentStep - 1, 0), TOTAL_STEPS);
  const displayStep = Math.min(currentStep, TOTAL_STEPS);
  const pct = (completed / TOTAL_STEPS) * 100;

  return (
    <header
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "28px 20px 16px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: '"Cabinet Grotesk", "Inter", sans-serif',
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: "-0.02em",
          color: "var(--txt-dark-hi)",
          margin: 0,
        }}
      >
        Your Path
      </h1>
      <p
        style={{
          margin: "4px 0 12px",
          color: "var(--mut-dark-hi)",
          fontSize: 13,
          letterSpacing: "0.02em",
        }}
      >
        Step {displayStep} of {TOTAL_STEPS}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={completed}
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--card-dark)",
          border: "1px solid var(--line-dark)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--cta)",
            borderRadius: 999,
            transition: "width 400ms cubic-bezier(.16,1,.3,1)",
            boxShadow: "0 0 12px rgba(229,181,71,0.5)",
          }}
        />
      </div>
    </header>
  );
}
