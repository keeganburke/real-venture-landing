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
              <div className="hub2-schedule-note-title">Live Q&A + Deal Review</div>
              <div className="hub2-schedule-note-body">
                Bring any question and get your deals reviewed live. Nothing is too beginner.
              </div>
            </div>
          </div>

          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">💻</div>
            <div>
              <div className="hub2-schedule-note-title">Live working sessions</div>
              <div className="hub2-schedule-note-body">
                Coaching, buyer outreach, deal underwriting, and cold calls, live on screen with the coaches.
              </div>
            </div>
          </div>

          <div className="hub2-schedule-note">
            <div className="hub2-schedule-note-icon" aria-hidden="true">🎥</div>
            <div>
              <div className="hub2-schedule-note-title">Every call is recorded</div>
              <div className="hub2-schedule-note-body">
                Miss one? Recordings drop in Discord under #call-recordings.
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
