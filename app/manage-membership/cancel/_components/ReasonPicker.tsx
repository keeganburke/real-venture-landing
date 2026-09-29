"use client";

import { useRouter } from "next/navigation";
import { useFlowQuery } from "./CancelShell";

// Values match Whop's cancel_option enum where one exists; life_busy and
// no_results are ours.
const REASONS: { value: string; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "life_busy", label: "Life got busy" },
  { value: "not_using", label: "Not using it enough" },
  { value: "no_results", label: "Haven't closed a deal yet" },
  { value: "other", label: "Other" },
];

export default function ReasonPicker() {
  const router = useRouter();
  const { session } = useFlowQuery();

  const pick = (value: string) => {
    const q = new URLSearchParams({ reason: value });
    if (session) q.set("session", session);
    router.push(`/manage-membership/cancel/testimonial?${q.toString()}`);
  };

  return (
    <div className="cancel-opts">
      {REASONS.map((r) => (
        <button key={r.value} type="button" className="cancel-opt" onClick={() => pick(r.value)}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
