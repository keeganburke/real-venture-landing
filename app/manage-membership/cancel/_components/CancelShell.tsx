"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const REASON_PATH = "/manage-membership/cancel/reason";
const FINAL_PATH = "/manage-membership/cancel/final";
const CONFIRMED_PATH = "/manage-membership/cancel/confirmed";

type Props = {
  eyebrow: string;
  heading: string;
  sub?: string;
  requireReason?: boolean; // true: no ?reason= param sends the visitor back to /reason
  children: ReactNode;
};

// Everything that touches the URL lives here, behind a Suspense boundary:
// useSearchParams() opts the tree into client rendering and Next wants a
// boundary around it so the shell above can stream first.
function ShellInner({ eyebrow, heading, sub, requireReason = false, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reason = params.get("reason");
  const session = params.get("session");

  // Deep-link guard. A page past /reason with no reason in the URL means the
  // visitor skipped the first step; send them there. Client-side replace
  // because server redirect() is not available in a client component.
  useEffect(() => {
    if (requireReason && !reason) router.replace(REASON_PATH);
  }, [requireReason, reason, router]);

  // One session id for the whole flow, minted on the first page that lacks
  // it and carried in the URL so later analytics can correlate every step.
  useEffect(() => {
    if (session) return;
    if (requireReason && !reason) return; // the guard above is already redirecting
    const next = new URLSearchParams(params.toString());
    next.set("session", crypto.randomUUID());
    router.replace(`${pathname}?${next.toString()}`);
  }, [session, requireReason, reason, params, pathname, router]);

  // No "Cancel my membership" footer on the last two pages: /final has its
  // own cancel control, and /confirmed is past the point of cancelling.
  const hideFooter = pathname === FINAL_PATH || pathname === CONFIRMED_PATH;
  const finalHref = (() => {
    const q = new URLSearchParams();
    if (reason) q.set("reason", reason);
    if (session) q.set("session", session);
    const qs = q.toString();
    return qs ? `${FINAL_PATH}?${qs}` : FINAL_PATH;
  })();

  return (
    <main className="manage-mem-page cancel-page">
      <div className="cancel-shell">
        <header className="cancel-head">
          <div className="cancel-eyebrow">{eyebrow}</div>
          <h1 className="cancel-h">{heading}</h1>
          {sub && <p className="cancel-sub">{sub}</p>}
        </header>

        <div className="cancel-body">{children}</div>

        {!hideFooter && (
          <div className="cancel-foot">
            <button
              type="button"
              className="cancel-foot-link"
              onClick={() => router.push(finalHref)}
            >
              Cancel my membership
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// Shared by the flow's client components: the current reason/session and a
// helper that builds a same-flow href carrying both (plus any extras).
export function useFlowQuery() {
  const params = useSearchParams();
  const reason = params.get("reason");
  const session = params.get("session");
  const href = (path: string, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams();
    if (reason) q.set("reason", reason);
    if (session) q.set("session", session);
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    const qs = q.toString();
    return qs ? `${path}?${qs}` : path;
  };
  return { reason, session, href };
}

export default function CancelShell(props: Props) {
  return (
    <Suspense fallback={null}>
      <ShellInner {...props} />
    </Suspense>
  );
}
