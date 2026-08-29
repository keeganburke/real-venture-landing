import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Real Venture | Join the Discord",
};

// Guided walkthrough for members who are new to Discord. Both join buttons
// fire the existing OAuth flow; /api/discord/callback stays untouched.
export default function DiscordHelpPage() {
  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <div className="dh-stack">
          <nav className="hub2-nav">
            <Link href="/dashboard" className="hub2-menu">{"←"} Back to hub</Link>
          </nav>

          <header className="hub2-greeting">
            <h1 className="hub2-greeting-name">Joining the Real Venture Discord</h1>
            <p className="hub2-greeting-sub">Quick guide to get you into the community.</p>
          </header>

          <div className="dh-existing">
            <span>Already have a Discord account?</span>
            <a href="/api/discord/connect" className="dh-existing-btn">
              Log in and join {"→"}
            </a>
          </div>

          <section className="dh-step">
            <div className="dh-step-head">
              <span className="dh-step-num">1</span>
              <h2 className="dh-step-title">Create your Discord account</h2>
            </div>
            <img className="dh-shot" src="/images/discord-help/register.png" alt="Discord signup form" />
            <p className="dh-step-body">
              Head to discord.com and register. Use a real email. Discord requires you to
              verify it before you can join servers.
            </p>
            <a
              className="dh-btn"
              href="https://discord.com/register"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Discord Signup {"→"}
            </a>
          </section>

          <section className="dh-step">
            <div className="dh-step-head">
              <span className="dh-step-num">2</span>
              <h2 className="dh-step-title">Verify your email</h2>
            </div>
            <img className="dh-shot" src="/images/discord-help/discord-email.png" alt="Discord verification email" />
            <p className="dh-step-body">
              {'Discord sends a verification email. Check your inbox and click "Verify Email" in the email from noreply@discord.com.'}
            </p>
            <img className="dh-shot" src="/images/discord-help/email-verfified.png" alt="Email verified confirmation screen" />
            <p className="dh-step-body">
              {"You'll see this confirmation screen when your email is verified."}
            </p>
            <div className="dh-callout dh-callout-warn">
              {'⚠️ Important: After you verify, come back to THIS tab. Do not close it and do not click "Continue to Discord". That takes you somewhere else.'}
            </div>
          </section>

          <section className="dh-step">
            <div className="dh-step-head">
              <span className="dh-step-num">3</span>
              <h2 className="dh-step-title">Come back here and join</h2>
            </div>
            <p className="dh-step-body">
              Once your email is verified, click below to join the Real Venture Discord.
            </p>
            <a href="/api/discord/connect" className="dh-btn dh-btn-big">
              I verified. Join Real Venture Discord {"→"}
            </a>
          </section>

          <section className="dh-step">
            <div className="dh-step-head">
              <span className="dh-step-num">4</span>
              <h2 className="dh-step-title">Authorize the Real Venture bot</h2>
            </div>
            <img className="dh-shot" src="/images/discord-help/authorize.png" alt="Discord authorization screen" />
            <p className="dh-step-body">
              {'Discord will ask you to authorize Real Venture. Click "Authorize". This lets us add you to our server automatically and assign your member role.'}
            </p>
          </section>

          <div className="dh-callout dh-callout-error">
            <div className="dh-callout-title">
              {'If you see: "You need a verified email or phone number"'}
            </div>
            <img className="dh-shot" src="/images/discord-help/need-verify.png" alt="Discord verified email required error" />
            <p className="dh-step-body">
              {'This means your email isn\'t verified yet. Go back to your inbox, click "Verify Email" in Discord\'s email, then click the "I verified" button above to try again.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
