"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WEEKLY_SCHEDULE, type WeeklyCall } from "../hub-copy";
import { getCallDurationMs, getCallStartMs } from "../lib/next-calls";

const LA_TZ = "America/Los_Angeles";
const RECORDINGS_URL =
  "https://discord.com/channels/1268090071848980500/1522403978862657577";
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

        <p className="ls-tz-note">{tzNote}</p>

        {dayGroups.map(({ dayName, items }) => (
          <section className="ls-day" key={dayName}>
            <div className="ls-day-head">{dayName}</div>
            {items.map(({ call, startMs, endMs }) => (
              <div className="ls-card" key={call.id}>
                <div className="ls-card-title">{call.type}</div>
                <div className="ls-card-host">with {call.host}</div>
                <div className="ls-card-time">{fmtClock(startMs)} - {fmtClock(endMs)}{suffix}</div>
                {call.detail && <div className="ls-card-detail">{call.detail}</div>}
              </div>
            ))}
          </section>
        ))}

        <section className="livestreams-note">
          <ul className="ls-footer-list">
            <li>
              Check out past lives in{" "}
              <a
                href={RECORDINGS_URL}
                target="_blank"
                rel="noreferrer"
                className="livestreams-note-link"
              >
                #call-recordings
              </a>
            </li>
            <li>
              2 calls every single day. You don&apos;t need a deal to show up to any of
              them. Members who join calls are exponentially more likely to close a
              deal 💰
            </li>
            <li>
              All livestreams are held in the{" "}
              <a href="/api/discord/connect" className="livestreams-note-link">
                #live-calls
              </a>{" "}
              channel in Discord
            </li>
          </ul>
        </section>

      </div>
    </div>
  );
}
