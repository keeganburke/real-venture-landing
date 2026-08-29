import type { Metadata } from "next";
import Link from "next/link";
import { WEEKLY_SCHEDULE, type WeeklyCall } from "../hub-copy";

export const metadata: Metadata = {
  title: "Real Venture | Livestreams",
};

const DAY_ORDER: WeeklyCall["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL: Record<WeeklyCall["day"], string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export default function LivestreamsPage() {
  // One section per day, Mon-Sun; days without calls are skipped.
  const dayGroups = DAY_ORDER.map((day) => ({
    day,
    calls: WEEKLY_SCHEDULE.filter((call) => call.day === day),
  })).filter((group) => group.calls.length > 0);

  return (
    <div className="hub2-page">
      <div className="hub2-shell">

        <nav className="hub2-nav">
          <Link href="/dashboard" className="hub2-menu">← Back</Link>
        </nav>

        <header className="hub2-greeting">
          <h1 className="hub2-greeting-name">Livestreams</h1>
          <p className="hub2-greeting-sub">
            Full weekly schedule. All times PST.
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

        {dayGroups.map(({ day, calls }) => (
          <section className="ls-day" key={day}>
            <div className="ls-day-head">{DAY_FULL[day]}</div>
            {calls.map((call) => (
              <div className="ls-card" key={call.id}>
                <div className="ls-card-title">{call.type}</div>
                <div className="ls-card-host">with {call.host}</div>
                <div className="ls-card-time">{call.startTime} - {call.endTime} PST</div>
              </div>
            ))}
          </section>
        ))}

        <section className="hub2-schedule-notes">
          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">🎙</div>
            <div>
              <div className="hub2-schedule-note-title">Coaching, Q&A + Deal Review</div>
              <div className="hub2-schedule-note-body">
                Get unstuck with the coaches: mentorship, questions answered, and your deals reviewed live.
              </div>
            </div>
          </div>

          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">📞</div>
            <div>
              <div className="hub2-schedule-note-title">Buyer Outreach + Cold Calls</div>
              <div className="hub2-schedule-note-body">
                Hands-on working sessions: dial sellers and build your buyer list live alongside the team.
              </div>
            </div>
          </div>

          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">📊</div>
            <div>
              <div className="hub2-schedule-note-title">Underwriting + Deal Breakdowns</div>
              <div className="hub2-schedule-note-body">
                Learn the numbers: watch real deals get analyzed and broken down step by step.
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
