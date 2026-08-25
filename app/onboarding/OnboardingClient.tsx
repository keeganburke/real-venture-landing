"use client";

import { useState } from "react";
import type { IntakeAnswers } from "../../lib/intake-cookie";
import { INTAKE_QUESTIONS, type IntakeField } from "./intake-config";
import Welcome from "./steps/Welcome";
import Question from "./steps/Question";

type Props = {
  initialAnswers: Partial<IntakeAnswers>;
};

// Step 0 is the welcome screen; steps 1..5 are the questions.
function firstUnansweredStep(answers: Partial<IntakeAnswers>): number {
  const anyAnswered = INTAKE_QUESTIONS.some((q) => q.id in answers);
  if (!anyAnswered) return 0;
  const index = INTAKE_QUESTIONS.findIndex((q) => !(q.id in answers));
  return index === -1 ? INTAKE_QUESTIONS.length : index + 1;
}

async function saveAnswers(
  partial: Partial<IntakeAnswers>,
  complete: boolean
): Promise<string | null> {
  try {
    const res = await fetch("/api/intake/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(complete ? { ...partial, complete: true } : partial),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.redirect === "string" ? data.redirect : null;
  } catch {
    return null;
  }
}

export default function OnboardingClient({ initialAnswers }: Props) {
  const [step, setStep] = useState(() => firstUnansweredStep(initialAnswers));
  const [answers, setAnswers] = useState<Partial<IntakeAnswers>>(initialAnswers);
  const [busy, setBusy] = useState(false);

  const total = INTAKE_QUESTIONS.length;

  const finishAndRedirect = async (partial: Partial<IntakeAnswers>) => {
    setBusy(true);
    const redirect = await saveAnswers(partial, true);
    window.location.href = redirect ?? "/dashboard";
  };

  const submitAnswer = async (field: IntakeField, value: string | null) => {
    const partial = { [field]: value } as Partial<IntakeAnswers>;
    setAnswers((current) => ({ ...current, ...partial }));
    if (step === total) {
      await finishAndRedirect(partial);
      return;
    }
    setBusy(true);
    await saveAnswers(partial, false);
    setBusy(false);
    setStep(step + 1);
  };

  if (step === 0) {
    return (
      <main className="onb">
        <div className="onb-shell">
          <Welcome
            onStart={() => setStep(1)}
            onSkip={() => finishAndRedirect({})}
            busy={busy}
          />
        </div>
      </main>
    );
  }

  const question = INTAKE_QUESTIONS[step - 1];
  const selected = answers[question.id];

  return (
    <main className="onb">
      <div className="onb-shell">
        <Question
          question={question}
          number={step}
          total={total}
          selected={selected}
          busy={busy}
          onSelect={(value) =>
            setAnswers((current) => ({ ...current, [question.id]: value }))
          }
          onBack={step > 1 ? () => setStep(step - 1) : undefined}
          onSkip={() => submitAnswer(question.id, null)}
          onNext={() => {
            if (selected != null) submitAnswer(question.id, selected);
          }}
        />
      </div>
    </main>
  );
}
