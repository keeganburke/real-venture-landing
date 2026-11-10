"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Ask every 3 seconds, for 2 minutes per round. "Try again" starts a new
// round. Same card and buttons as /login and /membership-ended.
const EVERY_MS = 3000;
const ROUND_MS = 2 * 60 * 1000;
const STATUS_URL = "/api/auth/whop/purchase-status";
const SUPPORT = "realventureestate@gmail.com";

type Phase = "checking" | "slow" | "signin";

export default function FinishingPurchaseClient() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [round, setRound] = useState(0);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();
    const ask = async () => {
      if (!alive) return;
      try {
        const res = await fetch(STATUS_URL, { cache: "no-store", credentials: "same-origin" });
        const body = (await res.json()) as { status?: string; next?: string };
        if (!alive) return;
        if (body.status === "ready" && (body.next === "/dashboard" || body.next === "/onboarding")) {
          window.location.replace(body.next);
          return;
        }
        if (body.status === "signin") {
          setPhase("signin");
          return;
        }
      } catch {
        // a network blip: keep asking
      }
      if (!alive) return;
      if (Date.now() - startedAt >= ROUND_MS) {
        setPhase("slow");
        return;
      }
      timer.current = window.setTimeout(ask, EVERY_MS);
    };
    ask();
    return () => {
      alive = false;
      stop();
    };
  }, [round, stop]);

  const tryAgain = () => {
    setPhase("checking");
    setRound((r) => r + 1);
  };

  return (
    <div className="wrap">
      <main className="lp-login">
        <div className="lp-login-card" data-finishing={phase}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lp-login-logo" src="/logo.png" alt="Real Venture" width={160} height={160} />
          <div aria-live="polite">
            {phase === "checking" ? (
              <>
                <h1 className="lp-login-h">Finishing your purchase...</h1>
                <p className="lp-login-sub">
                  <span className="cf-btn-spinner" aria-hidden="true" />
                  Whop is confirming your membership. This usually takes a few seconds. Keep this page open and we&apos;ll
                  take you in.
                </p>
              </>
            ) : (
              <>
                <h1 className="lp-login-h">Still confirming your purchase</h1>
                <p className="lp-login-sub">
                  Whop hasn&apos;t confirmed your membership yet. Sometimes it takes a few minutes. Tap Try again, or
                  email us and we&apos;ll sort it out.
                </p>
              </>
            )}
          </div>
          {phase === "slow" && (
            <button type="button" className="lp-cta-primary lp-login-cta" onClick={tryAgain}>
              Try again {"→"}
            </button>
          )}
          {phase === "signin" && (
            <a className="lp-cta-primary lp-login-cta" href="/api/auth/whop/start?purchase=1">
              Try again {"→"}
            </a>
          )}
          {phase !== "checking" && (
            <>
              <p className="lp-login-join">
                Need help? Email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>
              </p>
              <p className="lp-login-join">
                Bought with a different Whop account?{" "}
                <a href="https://whop.com/logout" target="_blank" rel="noopener noreferrer">
                  Sign out of Whop
                </a>{" "}
                and sign in with that one.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
