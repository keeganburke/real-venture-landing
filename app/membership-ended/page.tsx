import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real Venture | Your membership has ended",
};

// Where the login gate and the dashboard send someone whose Real Venture
// memberships have all ended (lib/whop-access.ts). Not an error: a calm way
// back in. Same card and buttons as /login (app/globals.css, lp-login).
// Rejoin opens the pricing on the homepage (/?pricing=1, the same link as
// the login page's "Join"); "Refresh" runs the Whop sign in again marked as
// "I just paid" (?purchase=1), so a purchase Whop doesn't list yet gets the
// "Finishing your purchase" screen instead of this page again.
export default function MembershipEndedPage() {
  return (
    <div className="wrap">
      <main className="lp-login">
        <a className="lp-login-back" href="/">
          {"←"} Back
        </a>
        <div className="lp-login-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lp-login-logo" src="/logo.png" alt="Real Venture" width={160} height={160} />
          <h1 className="lp-login-h">Your membership has ended</h1>
          <p className="lp-login-sub">
            Thanks for being part of Real Venture. Rejoin any time to get the hub, the live calls and the Discord back.
          </p>
          <a className="lp-cta-primary lp-login-cta" href="/?pricing=1">
            Rejoin Real Venture {"→"}
          </a>
          <p className="lp-login-join">
            Already paid? It can take a minute to show up.{" "}
            <a href="/api/auth/whop/start?purchase=1">Refresh</a>
          </p>
          <p className="lp-login-join">
            Signed in with a different Whop account than the one you paid with?{" "}
            <a href="https://whop.com/logout" target="_blank" rel="noopener noreferrer">
              Sign out of Whop
            </a>{" "}
            and sign in again.
          </p>
          <p className="lp-login-join">
            Questions? Email <a href="mailto:realventureestate@gmail.com">realventureestate@gmail.com</a>
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
