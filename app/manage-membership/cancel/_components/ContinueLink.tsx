"use client";

import Link from "next/link";
import { useFlowQuery } from "./CancelShell";

type Target = { label: string; to: string; extra?: Record<string, string> };

type Props = {
  primary?: Target;
  // The secondary link is the "keep going toward cancelling" path, so it
  // renders in the soft .cancel-btn-quit style by default and the primary
  // (or the page's own cards) stays visually dominant. Pass soft: false for
  // the plainer .cancel-btn-secondary look.
  secondary: Target & { soft?: boolean };
};

// Primary button + secondary text link, both carrying ?reason and ?session
// forward so every page in the flow stays on the same session.
export default function ContinueLink({ primary, secondary }: Props) {
  const { href } = useFlowQuery();
  return (
    <div className="cancel-continue">
      {primary && (
        <Link href={href(primary.to, primary.extra)} className="cancel-btn-primary">
          {primary.label}
        </Link>
      )}
      <Link
        href={href(secondary.to, secondary.extra)}
        className={secondary.soft === false ? "cancel-btn-secondary" : "cancel-btn-quit"}
      >
        {secondary.label}
      </Link>
    </div>
  );
}
