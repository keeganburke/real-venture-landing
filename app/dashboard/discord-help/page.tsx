export const metadata = {
  title: "Join Discord — Real Venture",
};

export default function DiscordHelpPage() {
  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <nav className="hub2-nav">
          <a className="hub2-menu" href="/dashboard">← Back to hub</a>
        </nav>

        <header className="dh-header">
          <h1 className="dh-h1">Joining the Real Venture Discord</h1>
          <p className="dh-sub">You&apos;re 2 minutes away.</p>
        </header>

        {/* Shortcut card for users who already have Discord */}
        <a href="#step-3" className="dh-shortcut">
          <div className="dh-shortcut-eyebrow">✅ ALREADY HAVE DISCORD?</div>
          <div className="dh-shortcut-title">Skip straight to step 3. Takes 10 seconds.</div>
          <span className="dh-shortcut-cta">Jump to step 3 →</span>
        </a>

        <div className="dh-divider">
          <span>OR IF YOU DON&apos;T HAVE DISCORD</span>
        </div>

        {/* STEP 1 — Create account */}
        <section className="dh-step">
          <div className="dh-step-num">1</div>
          <div className="dh-step-body">
            <h2 className="dh-step-title">Make a Discord account</h2>
            <p className="dh-step-copy">
              Tap below, then sign up with a real email. Discord sends a verification email.
            </p>
            <img
              src="/images/discord-help/register.png"
              alt="Discord signup form"
              className="dh-shot"
            />
            <a
              href="https://discord.com/register"
              target="_blank"
              rel="noopener noreferrer"
              className="dh-cta"
            >
              Sign up now →
            </a>
          </div>
        </section>

        {/* STEP 2 — Verify email */}
        <section className="dh-step">
          <div className="dh-step-num">2</div>
          <div className="dh-step-body">
            <h2 className="dh-step-title">Verify your email</h2>
            <p className="dh-step-copy">
              Discord sends a &quot;Verify Email Address&quot; email. Tap Verify Email inside it.
            </p>
            <img
              src="/images/discord-help/discord-email.png"
              alt="Discord verification email"
              className="dh-shot"
            />

            {/* LOUD RED WARNING — the #1 failure point */}
            <div className="dh-warning">
              <div className="dh-warning-icon">🛑</div>
              <div className="dh-warning-body">
                <div className="dh-warning-title">STOP, READ THIS</div>
                <p className="dh-warning-copy">
                  After you verify, Discord shows a page with <strong>&quot;Continue to Discord.&quot;</strong>
                </p>
                <p className="dh-warning-copy">
                  <strong>DO NOT TAP THAT BUTTON.</strong>
                </p>
                <p className="dh-warning-copy">
                  Come back to THIS tab in your browser.
                </p>
              </div>
            </div>

            <a href="#step-3" className="dh-cta dh-cta-secondary">
              I verified my email →
            </a>
          </div>
        </section>

        {/* STEP 3 — Join Real Venture */}
        <section className="dh-step" id="step-3">
          <div className="dh-step-num">3</div>
          <div className="dh-step-body">
            <h2 className="dh-step-title">Join Real Venture</h2>
            <p className="dh-step-copy">
              Tap the button. Discord asks you to authorize Real Venture. Tap Authorize.
            </p>
            <img
              src="/images/discord-help/authorize.png"
              alt="Discord authorization screen"
              className="dh-shot"
            />
            <a href="/api/discord/connect" className="dh-cta dh-cta-primary">
              ⚡ Join the Discord →
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
