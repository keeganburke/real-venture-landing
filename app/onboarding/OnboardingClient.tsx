"use client";

import { useState } from "react";
import type { IntakeAnswers } from "../../lib/intake-cookie";
import { INTAKE_QUESTIONS } from "./intake-config";
import Welcome from "./steps/Welcome";
import QuestionText from "./steps/QuestionText";
import QuestionSingle from "./steps/QuestionSingle";
import QuestionMulti from "./steps/QuestionMulti";

type Props = {
  initialAnswers: Partial<IntakeAnswers>;
};

// Step map: 0 = welcome hero, 1..N = questions. The final question redirects
// straight to the hub, where /dashboard?tour=1 opens the spotlight tour.
const TOTAL_Q = INTAKE_QUESTIONS.length;

async function saveAnswers(
  partial: Partial<IntakeAnswers>,
  complete: boolean
): Promise<void> {
  try {
    await fetch("/api/intake/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(complete ? { ...partial, complete: true } : partial),
    });
  } catch {
    // Non-fatal: the answer is still in local state and re-sent on completion.
  }
}

// Marks step 0 as seen. The cookie field is named tourCompletedAt for
// historical reasons; it now gates only the welcome hero.
async function saveTourDone(): Promise<void> {
  try {
    await fetch("/api/intake/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourDone: true }),
    });
  } catch {
    // Non-fatal: the hero just shows again next visit.
  }
}

export default function OnboardingClient({ initialAnswers }: Props) {
  const [step, setStep] = useState(() => (initialAnswers.tourCompletedAt ? 1 : 0));
  const [answers, setAnswers] = useState<Partial<IntakeAnswers>>(initialAnswers);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof IntakeAnswers>(key: K, value: IntakeAnswers[K]) =>
    setAnswers((current) => ({ ...current, [key]: value }));

  const startQuestions = async () => {
    setBusy(true);
    await saveTourDone();
    setBusy(false);
    setStep(1);
  };

  // Final save + hand-off. The last question's value arrives as `partial`
  // and is merged in explicitly, because the setAnswers from onChange may not
  // have flushed yet. ?tour=1 tells the hub to auto-open the spotlight tour.
  const finish = async (partial: Partial<IntakeAnswers>) => {
    setBusy(true);
    await saveAnswers({ ...answers, ...partial }, true);
    window.location.href = "/dashboard?tour=1";
  };

  // Persist this screen's answer, then advance. The final question finishes
  // instead of stepping forward.
  const advance = async (partial: Partial<IntakeAnswers>) => {
    if (step === TOTAL_Q) {
      await finish(partial);
      return;
    }
    setBusy(true);
    await saveAnswers(partial, false);
    setBusy(false);
    setStep((s) => s + 1);
  };

  if (step === 0) {
    return (
      <main className="onb">
        <div className="onb-shell">
          <Welcome onStart={startQuestions} busy={busy} />
        </div>
      </main>
    );
  }

  const q = INTAKE_QUESTIONS[step - 1];
  const number = step;
  const isLast = step === TOTAL_Q;
  const nextLabel = isLast ? "Finish →" : "Next →";
  const onBack = step > 1 ? () => setStep(step - 1) : undefined;

  const shell = (node: React.ReactNode) => (
    <main className="onb">
      <div className="onb-shell">{node}</div>
    </main>
  );

  if (q.kind === "text") {
    const value = (answers[q.id] as string | null | undefined) ?? "";
    return shell(
      <QuestionText
        question={q}
        number={number}
        total={TOTAL_Q}
        value={value}
        onChange={(v) => set(q.id, v)}
        onBack={onBack}
        onNext={() => void advance({ [q.id]: value } as Partial<IntakeAnswers>)}
        nextLabel={nextLabel}
      />
    );
  }

  if (q.kind === "single") {
    const value = (answers[q.id] as string | null | undefined) ?? null;
    return shell(
      <QuestionSingle
        question={q}
        number={number}
        total={TOTAL_Q}
        value={value}
        onChange={(v) => set(q.id, v as never)}
        onBack={onBack}
        onNext={() => void advance({ [q.id]: value } as Partial<IntakeAnswers>)}
        nextLabel={nextLabel}
      />
    );
  }

  if (q.kind === "multi") {
    type TriedValue = NonNullable<IntakeAnswers["tried"]>[number];
    const value = answers.tried ?? [];
    const followup = answers.tried_failure ?? "";
    return shell(
      <QuestionMulti
        question={q}
        number={number}
        total={TOTAL_Q}
        value={value}
        onChange={(v) => set("tried", v as TriedValue[])}
        followupValue={followup}
        onFollowupChange={(v) => set("tried_failure", v)}
        onBack={onBack}
        onNext={() => void advance({ tried: value, tried_failure: followup || null })}
        nextLabel={nextLabel}
      />
    );
  }

  // Unreachable: every kind above is handled. Keeps the function total.
  return null;
}
