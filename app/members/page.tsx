"use client";

// Locked-down login for existing members: /login minus the back link,
// the post-purchase note, and the join link. No escape hatches.
export default function MembersPage() {
  return (
    <div className="wrap">
      <main className="lp-login">
        <div className="lp-login-card">
          <img
            className="lp-login-logo"
            src="/logo.png"
            alt="Real Venture"
            width={160}
            height={160}
          />
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
