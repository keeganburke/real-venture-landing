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
