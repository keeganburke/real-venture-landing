"use client";

import { Suspense, useCallback, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const REASON_PATH = "/manage-membership/cancel/reason";
const TESTIMONIAL_PATH = "/manage-membership/cancel/testimonial";
const FINAL_PATH = "/manage-membership/cancel/final";
const CONFIRMED_PATH = "/manage-membership/cancel/confirmed";

// ---------------------------------------------------------------------------
// Analytics. Same endpoint and body shape the old modal used
// (/api/cancel-events/log: event_type, session_id UUID, membership_id, plan,
// event_data; the route fills user_id from the rv_session cookie). The flow
// has no membership_id / plan client-side, so both go up as null. Every event
// fires at most ONCE per flow session: an in-memory set catches re-renders and
// StrictMode double effects, sessionStorage catches page remounts.
// ---------------------------------------------------------------------------
const LOG_URL = "/api/cancel-events/log";
const LOG_TIMEOUT_MS = 1200;
const fired = new Set<string>();

function eventKey(session: string, type: string) {
  return `rv_cancel_evt:${session}:${type}`;
}

function postEvent(session: string, type: string, data?: Record<string, unknown>): Promise<void> {
  return fetch(LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event_type: type,
      session_id: session,
      membership_id: null,
      plan: null,
      event_data: data ?? null,
    }),
  })
    .then(() => undefined)
    .catch(() => undefined);
}

// logOnce(type, data) -> resolves true if this call sent the event, false if
// it was already sent for this session (or there is no session yet). It never
// rejects, and it never takes longer than LOG_TIMEOUT_MS to resolve, so a
// caller can await it right before a hard redirect.
export function useCancelEvents() {
  const { session } = useFlowQuery();
  const logOnce = useCallback(
    (type: string, data?: Record<string, unknown>): Promise<boolean> => {
      if (!session) return Promise.resolve(false);
      const key = eventKey(session, type);
      if (fired.has(key)) return Promise.resolve(false);
      try {
        if (sessionStorage.getItem(key)) {
          fired.add(key);
          return Promise.resolve(false);
        }
      } catch {}
      fired.add(key);
      try {
        sessionStorage.setItem(key, "1");
      } catch {}
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, LOG_TIMEOUT_MS));
      return Promise.race([postEvent(session, type, data), timeout]).then(() => true);
    },
    [session]
  );
  return { session, logOnce };
}

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
  const { logOnce } = useCancelEvents();

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

  // Page-view events, once per session each (see useCancelEvents). They wait
  // for the session id, so the very first render of /reason (before the
  // replace above lands) does not fire without one.
  useEffect(() => {
    if (!session) return;
    if (requireReason && !reason) return;
    if (pathname === REASON_PATH) void logOnce("cancel_flow_started");
    else if (pathname === TESTIMONIAL_PATH) void logOnce("testimonial_shown", reason ? { reason } : undefined);
    else if (pathname === FINAL_PATH) void logOnce("loss_screen_viewed");
  }, [pathname, session, reason, requireReason, logOnce]);

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
