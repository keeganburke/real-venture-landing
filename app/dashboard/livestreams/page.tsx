"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WEEKLY_SCHEDULE, type WeeklyCall } from "../hub-copy";
import { getCallDurationMs, getCallStartMs } from "../lib/next-calls";

const LA_TZ = "America/Los_Angeles";
const DAY_SEQ = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Entry = {
  call: WeeklyCall;
  startMs: number;
  endMs: number;
};

// Schedule times are stored as PST wall-clock in WEEKLY_SCHEDULE; each call's
// next occurrence is converted into the viewer's timezone for display, and
// day grouping follows the viewer's local day (a 6 PM PST call is 2 AM the
// NEXT day in Europe, so headers regroup accordingly).
export default function LivestreamsPage() {
  const [viewerTz, setViewerTz] = useState<string | null>(null);
  useEffect(() => {
    try {
      setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Keep the PST fallback.
    }
  }, []);
  const zone = viewerTz ?? LA_TZ;

  const entries: Entry[] = useMemo(
    () =>
      WEEKLY_SCHEDULE.map((call) => {
        const startMs = getCallStartMs(call);
        return { call, startMs, endMs: startMs + getCallDurationMs(call) };
      }),
    []
  );

  const fmtClock = (ms: number) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone }).format(ms);
  const weekdayOf = (ms: number) =>
    new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: zone }).format(ms);
  const minutesOf = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      timeZone: zone,
    }).formatToParts(ms);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return (get("hour") % 24) * 60 + get("minute");
  };

  const dayGroups = DAY_SEQ.map((dayName) => ({
    dayName,
    items: entries
      .filter((entry) => weekdayOf(entry.startMs) === dayName)
      .sort((a, b) => minutesOf(a.startMs) - minutesOf(b.startMs)),
  })).filter((group) => group.items.length > 0);

  const suffix = zone === LA_TZ ? " PST" : "";
  const tzNote = viewerTz
    ? zone === LA_TZ
      ? "Shown in your local time (PST)"
      : "Shown in your local time"
    : "All times PST";

  return (
    <div className="hub2-page">
      <div className="hub2-shell">

        <nav className="hub2-nav">
          <Link href="/dashboard" className="hub2-menu">← Back</Link>
        </nav>

        <header className="hub2-greeting">
          <h1 className="hub2-greeting-name">Livestreams</h1>
          <p className="hub2-greeting-sub">
            Full weekly schedule.
          </p>
        </header>

        <section className="livestreams-note">
          <p>
            Live streams are held in the Discord{" "}
            <a href="/api/discord/connect" className="livestreams-note-link">
              voice channel
            </a>.
          </p>
        </section>

        <p className="ls-tz-note">{tzNote}</p>

        {dayGroups.map(({ dayName, items }) => (
          <section className="ls-day" key={dayName}>
            <div className="ls-day-head">{dayName}</div>
            {items.map(({ call, startMs, endMs }) => (
              <div className="ls-card" key={call.id}>
                <div className="ls-card-title">{call.type}</div>
                <div className="ls-card-host">with {call.host}</div>
                <div className="ls-card-time">{fmtClock(startMs)} - {fmtClock(endMs)}{suffix}</div>
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
