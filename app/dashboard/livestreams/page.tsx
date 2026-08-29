import type { Metadata } from "next";
import Link from "next/link";
import { WEEKLY_SCHEDULE } from "../hub-copy";

export const metadata: Metadata = {
  title: "Real Venture | Group Calls Schedule",
};

export default function LivestreamsPage() {
  return (
    <div className="hub2-page">
      <div className="hub2-shell">

        <nav className="hub2-nav">
          <Link href="/dashboard" className="hub2-logo-link" aria-label="Back to hub">
            <img src="/logo.png" alt="" aria-hidden="true" width={120} height={120} style={{ display: "block", objectFit: "contain" }} />
          </Link>
          <Link href="/dashboard" className="hub2-menu">← Back</Link>
        </nav>

        <header className="hub2-greeting">
          <div className="hub2-greeting-eyebrow">Group calls</div>
          <h1 className="hub2-greeting-name">Weekly schedule</h1>
          <p className="hub2-greeting-sub">
            Live calls 7 days a week. All times PST.
          </p>
        </header>

        <section className="livestreams-note">
          <p>
            All times PST. Live streams are held in the Discord{" "}
            <a href="/api/discord/connect" className="livestreams-note-link">
              voice channel
            </a>.
          </p>
        </section>

        <section className="hub2-schedule-card">
          <div className="hub2-schedule-list">
            {WEEKLY_SCHEDULE.map((call) => (
              <div key={call.id} className="hub2-schedule-row">
                <div className="hub2-schedule-day">{call.day}</div>
                <div className="hub2-schedule-body">
                  <div className="hub2-schedule-title">{call.type}</div>
                  <div className="hub2-schedule-hosts">with {call.host} · {call.startTime} - {call.endTime} PST</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="hub2-schedule-notes">
          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">🎙</div>
            <div>
              <div className="hub2-schedule-note-title">Live Q&A calls</div>
              <div className="hub2-schedule-note-body">
                {"Bring every question you've got, no matter how beginner it feels. Clear answers on deals, contracts, sellers, numbers. Straight from experience. The call doesn't end until every question is answered."}
              </div>
            </div>
          </div>

          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">💻</div>
            <div>
              <div className="hub2-schedule-note-title">Live Grind sessions</div>
              <div className="hub2-schedule-note-body">
                Co-work with the coaches. Comp deals, build your buyers list, send offers. Working live on screen while you work on your own deals at the same time.
              </div>
            </div>
          </div>

          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">🎥</div>
            <div>
              <div className="hub2-schedule-note-title">Every call is recorded</div>
              <div className="hub2-schedule-note-body">
                Miss a call? Recordings are posted in the Discord under #call-recordings.
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
