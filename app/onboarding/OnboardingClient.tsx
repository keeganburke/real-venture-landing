"use client";

import { useState } from "react";
import type { IntakeAnswers } from "../../lib/intake-cookie";
import { INTAKE_QUESTIONS } from "./intake-config";
import Welcome from "./steps/Welcome";
import QuestionText from "./steps/QuestionText";
import QuestionSingle from "./steps/QuestionSingle";
import QuestionMulti from "./steps/QuestionMulti";
import QuestionPhone from "./steps/QuestionPhone";
import QuestionNumber from "./steps/QuestionNumber";
import QuestionScaleTen from "./steps/QuestionScaleTen";
import SituationMatchCard, { type Situation } from "./steps/SituationMatchCard";

type Props = {
  initialAnswers: Partial<IntakeAnswers>;
};

// Step map: 0 = welcome hero, 1..N = questions. The final question redirects
// straight to the hub, where /dashboard?tour=1 opens the spotlight tour.
const TOTAL_Q = INTAKE_QUESTIONS.length;

// Branch follow-up under the 1-10 scale. Copy lives here, not in the config,
// because it depends on the picked value. No em dashes (repo rule).
function scaleFollowupCopy(value: number): { prompt: string; hint?: string } {
  if (value >= 9) {
    return { prompt: "You're all-in. What's the first deal size you want to hit?" };
  }
  if (value >= 5) {
    return {
      prompt: "What would push you to a 10?",
      hint: "If there was a guarantee, if it was cheaper, if you had more time, if the community was different - whatever it is. There's no wrong answer.",
    };
  }
  return {
    prompt: "You answered honestly, which we respect.",
    hint: "Tell us what's making you feel that way so William can build you the best plan for your situation. A guarantee, price, time, confidence - whatever it is. There's no wrong answer.",
  };
}

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
  // Display-only interstitial after the situation question. Not a step:
  // it collects nothing and does not count toward TOTAL_Q.
  const [showingMatchCard, setShowingMatchCard] = useState(false);

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

    // Situation: save the answer, then show the match card instead of
    // advancing. Continue on the card performs the step change.
    if (q.id === "situation" && showingMatchCard && value) {
      return shell(
        <SituationMatchCard
          situation={value as Situation}
          onBack={() => setShowingMatchCard(false)}
          onContinue={() => {
            setShowingMatchCard(false);
            setStep((s) => s + 1);
          }}
        />
      );
    }
    const onNext =
      q.id === "situation"
        ? async () => {
            setBusy(true);
            await saveAnswers({ situation: value as IntakeAnswers["situation"] }, false);
            setBusy(false);
            setShowingMatchCard(true);
          }
        : () => void advance({ [q.id]: value } as Partial<IntakeAnswers>);

    return shell(
      <QuestionSingle
        question={q}
        number={number}
        total={TOTAL_Q}
        value={value}
        onChange={(v) => set(q.id, v as never)}
        onBack={onBack}
        onNext={() => void onNext()}
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

  if (q.kind === "scaleTen") {
    const value = answers.seriousness_scale ?? null;
    const followupText = answers.seriousness_followup ?? "";
    const copy = value == null ? null : scaleFollowupCopy(value);
    return shell(
      <QuestionScaleTen
        question={q}
        number={number}
        total={TOTAL_Q}
        value={value}
        onChange={(n) => set("seriousness_scale", n)}
        followup={
          copy
            ? { ...copy, value: followupText, onChange: (v) => set("seriousness_followup", v) }
            : null
        }
        onBack={onBack}
        onNext={() =>
          void advance({ seriousness_scale: value, seriousness_followup: followupText.trim() || null })
        }
        nextLabel={nextLabel}
      />
    );
  }

  if (q.kind === "number") {
    const value = answers.age == null ? "" : String(answers.age);
    return shell(
      <QuestionNumber
        question={q}
        number={number}
        total={TOTAL_Q}
        value={value}
        onChange={(v) => set("age", v === "" ? null : Number(v))}
        onBack={onBack}
        onNext={() => void advance({ age: value === "" ? null : Number(value) })}
        nextLabel={nextLabel}
      />
    );
  }

  if (q.kind === "phone") {
    const value = answers.phone ?? "";
    return shell(
      <QuestionPhone
        question={q}
        number={number}
        total={TOTAL_Q}
        value={value}
        onChange={(v) => set("phone", v)}
        onBack={onBack}
        onNext={() => void advance({ phone: value.trim() || null })}
        nextLabel={nextLabel}
      />
    );
  }

  // Unreachable: every kind above is handled. Keeps the function total.
  return null;
}
