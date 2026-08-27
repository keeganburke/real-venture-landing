"use client";

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
            {"Just bought your membership? Sign in with the same email you paid with, that is where your membership lives. A different email will look like an empty account."}
          </p>
          <p className="lp-login-join">
            {"Don't have an account? "}
            <a href="/?pricing=1">Join</a>
          </p>
        </div>
      </main>
    </div>
  );
}
