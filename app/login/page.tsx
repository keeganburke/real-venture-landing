"use client";

import { Suspense, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

type Banner = { title: string; body: ReactNode; denied: boolean };

// Whop OAuth failures redirect here as /login?auth=<code> so the retry button
// is on the same screen as the explanation. LandingClient keeps its own
// AUTH_MESSAGES copy for anyone hitting /?auth= from an old link.
function bannerFor(code: string): Banner {
  switch (code) {
    case "denied":
      return {
        title: "Wrong email",
        body: (
          <>
            That email doesn&apos;t have an active Real Venture membership. Sign in with the{" "}
            <strong>EXACT</strong> email you used to buy.
          </>
        ),
        denied: true,
      };
    case "state_mismatch":
      return {
        title: "Sign-in got interrupted",
        body: (
          <>
            Please try again. If you opened this from Instagram, TikTok, or another app, tap the
            ••• menu and choose <strong>&apos;Open in Safari&apos;</strong> first.
          </>
        ),
        denied: false,
      };
    case "whop_error":
      return {
        title: "Something went wrong",
        body: "Whop couldn't complete sign-in. Please try again in a minute.",
        denied: false,
      };
    case "missing_code":
      return { title: "Sign-in got interrupted", body: "Please try again.", denied: false };
    default:
      return { title: "Sign-in didn't complete", body: "Please try again.", denied: false };
  }
}

function AuthBanner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("auth");
  const [dismissed, setDismissed] = useState(false);

  if (!code || dismissed) return null;
  const banner = bannerFor(code);

  const dismiss = () => {
    setDismissed(true);
    const params = new URLSearchParams(window.location.search);
    params.delete("auth");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? "?" + rest : ""));
  };

  return (
    <div className={`lp-login-banner${banner.denied ? " is-denied" : ""}`} role="alert">
      <div className="lp-login-banner-body">
        <div className="lp-login-banner-title">{banner.title}</div>
        <p className="lp-login-banner-copy">{banner.body}</p>
      </div>
      <button
        type="button"
        className="lp-login-banner-dismiss"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        {"×"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="wrap">
      <main className="lp-login">
        <a className="lp-login-back" href="/">
          {"←"} Back
        </a>
        <div className="lp-login-card">
          <img
            className="lp-login-logo"
            src="/logo.png"
            alt="Real Venture"
            width={160}
            height={160}
          />
          {/* useSearchParams needs a Suspense boundary to keep this page
              statically prerenderable. */}
          <Suspense fallback={null}>
            <AuthBanner />
          </Suspense>
          <h1 className="lp-login-h">Welcome Back</h1>
          <p className="lp-login-sub">Sign in with your Whop account to continue</p>
          <button
            className="lp-cta-primary lp-login-cta"
            onClick={() => {
              window.location.href = "/api/auth/whop/start";
            }}
          >
            <img src="/whoplogo3.png" alt="" className="lp-login-whop-icon" />
            Login with Whop {"→"}
          </button>
          <p className="lp-login-note">
            Sign in with the <strong>EXACT</strong> email you used to buy. A{" "}
            <strong>different email</strong> will look like an empty account.
          </p>
          <p className="lp-login-join">
            {"Don't have an account? "}
            <a href="/?pricing=1">Join</a>
          </p>
        </div>

        <footer className="lp-login-legal">
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms of Service</a>
          <span aria-hidden="true">·</span>
          <a href="/disclaimer">Disclaimer</a>
        </footer>
      </main>
    </div>
  );
}
