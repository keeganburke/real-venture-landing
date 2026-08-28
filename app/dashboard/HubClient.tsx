"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Destination, FeedbackAction, Livestream } from "./hub-copy";

type NextLessonInfo = {
  title: string;
  courseTitle: string;
  durationMin: number | null;
  href: string;
  sequenceIndex: number;
};

type Props = {
  displayName: string | null;
  doneCount: number;
  totalLessons: number;
  nextLesson: NextLessonInfo | null;
  livestreams: Livestream[];
  destinations: Destination[];
  feedback: FeedbackAction[];
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDay(iso: string) {
  const d = new Date(iso);
  return { month: MONTH_NAMES[d.getMonth()], day: d.getDate(), weekday: DAY_NAMES[d.getDay()] };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  return d.toLocaleTimeString("en-US", opts);
}

function isTomorrow(iso: string) {
  const d = new Date(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

function isToday(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString();
}

function getDiscordStatusInfo(status: string): { message: string; variant: "success" | "info" | "error" } {
  switch (status) {
    case "connected":
      return { message: "🎉 You're in the Discord.", variant: "success" };
    case "already_in_server":
      return { message: "✓ Discord role updated.", variant: "success" };
    case "cancelled":
      return { message: "Discord connection cancelled.", variant: "info" };
    case "role_failed":
      return { message: "Almost there. Reach out in Discord if you don't see the role.", variant: "info" };
    case "misconfigured":
      return { message: "Discord isn't set up. Contact support.", variant: "error" };
    default:
      return { message: "Something went wrong. Try again.", variant: "error" };
  }
}

export default function HubClient({
  displayName,
  doneCount,
  totalLessons,
  nextLesson,
  livestreams,
  destinations,
  feedback,
}: Props) {
  const [discordStatus, setDiscordStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("discord");
    if (!status) return;

    setDiscordStatus(status);

    // Strip the query param so refresh doesn't re-show
    params.delete("discord");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);

    // Auto-hide after 5 seconds
    const timer = setTimeout(() => setDiscordStatus(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  const featured = livestreams.find((l) => l.isFeatured) ?? livestreams[0];
  const rest = livestreams.filter((l) => l.id !== featured?.id).slice(0, 3);
  const progressPct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;
  const isComplete = nextLesson === null && totalLessons > 0;

  return (
    <div className="hub2-page">
      <div className="hub2-shell">

        {discordStatus && (() => {
          const info = getDiscordStatusInfo(discordStatus);
          return (
            <div className={`hub2-banner hub2-banner-${info.variant}`}>
              <span className="hub2-banner-message">{info.message}</span>
              <button
                type="button"
                className="hub2-banner-close"
                onClick={() => setDiscordStatus(null)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })()}

        {/* Top nav */}
        <nav className="hub2-nav">
          <div className="hub2-logo" aria-hidden="true">RV</div>
          <button type="button" className="hub2-menu">MENU</button>
        </nav>

        {/* Greeting. Nameless fallback: "Welcome back" becomes the heading. */}
        <header className="hub2-greeting">
          {displayName && <div className="hub2-greeting-eyebrow">Welcome back</div>}
          <h1 className="hub2-greeting-name">{displayName ?? "Welcome back"}</h1>
          <p className="hub2-greeting-sub">
            {isComplete
              ? "You've completed the curriculum. Nice work."
              : `${doneCount} of ${totalLessons} lessons done. Let's keep it moving.`}
          </p>
        </header>

        {/* Hero: next lesson */}
        {nextLesson && (
          <section className="hub2-hero">
            <div className="hub2-hero-eyebrow">Pick up where you left off</div>
            <div className="hub2-hero-course">
              {nextLesson.courseTitle} · Lesson {nextLesson.sequenceIndex} of {totalLessons}
            </div>
            <div className="hub2-hero-title">{nextLesson.title}</div>
            <div className="hub2-hero-meta">
              {nextLesson.durationMin && (
                <>
                  <span className="hub2-hero-meta-item">▶ {nextLesson.durationMin} min</span>
                  <span className="hub2-hero-meta-dot" aria-hidden="true"></span>
                </>
              )}
              <span className="hub2-hero-meta-item">5 quiz questions</span>
            </div>
            <div className="hub2-hero-progress">
              <div className="hub2-hero-progress-bar">
                <div className="hub2-hero-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="hub2-hero-progress-num">{doneCount}/{totalLessons}</div>
            </div>
            <Link href={nextLesson.href} className="hub2-hero-cta">
              <span>Continue lesson</span>
              <span className="hub2-hero-cta-arrow" aria-hidden="true">→</span>
            </Link>
          </section>
        )}

        {isComplete && (
          <section className="hub2-hero hub2-hero-complete">
            <div className="hub2-hero-eyebrow">Curriculum complete</div>
            <div className="hub2-hero-title">{"You've finished all 13 lessons."}</div>
            <p className="hub2-hero-complete-sub">
              Time to close a deal. Jump into Studio or the community.
            </p>
          </section>
        )}

        {/* Livestreams */}
        <div className="hub2-section-head">
          <div className="hub2-section-title">Group Calls</div>
          <Link href="/dashboard/livestreams" className="hub2-section-link">Full schedule →</Link>
        </div>

        {featured && (
          <div className="hub2-livestream">
            <div className="hub2-livestream-date">
              <div className="hub2-livestream-date-month">{formatDay(featured.dateISO).month}</div>
              <div className="hub2-livestream-date-day">{formatDay(featured.dateISO).day}</div>
            </div>
            <div className="hub2-livestream-body">
              <div className="hub2-livestream-label">
                <span className="hub2-livestream-pulse" aria-hidden="true"></span>
                {isToday(featured.dateISO) ? "Today" : isTomorrow(featured.dateISO) ? "Tomorrow" : formatDay(featured.dateISO).weekday}
              </div>
              <div className="hub2-livestream-title">{featured.title}</div>
              <div className="hub2-livestream-time">{formatTime(featured.dateISO)} · {featured.host}</div>
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div className="hub2-upcoming">
            {rest.map((ls) => {
              const d = formatDay(ls.dateISO);
              return (
                <div key={ls.id} className="hub2-upcoming-row">
                  <div className="hub2-upcoming-day">
                    <div className="hub2-upcoming-day-name">{d.weekday}</div>
                    <div className="hub2-upcoming-day-num">{d.day}</div>
                  </div>
                  <div className="hub2-upcoming-body">
                    <div className="hub2-upcoming-title">{ls.title}</div>
                    <div className="hub2-upcoming-time">{formatTime(ls.dateISO)} · {ls.host}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Discord CTA. Always visible tonight. Detection later. */}
        <section className="hub2-discord">
          <div className="hub2-discord-icon" aria-hidden="true">💬</div>
          <div className="hub2-discord-title">Join the community</div>
          <p className="hub2-discord-sub">
            350+ members closing deals every week. Ask questions, share wins, get help.
          </p>
          <a
            href="/api/discord/connect"
            className="hub2-discord-cta"
          >
            <span>Join Discord</span>
            <span aria-hidden="true">↗</span>
          </a>
        </section>

        {/* Destinations */}
        <div className="hub2-section-head">
          <div className="hub2-section-title">Everything else</div>
        </div>
        <div className="hub2-destinations">
          {destinations.map((d) => (
            <a
              key={d.id}
              href={d.href}
              className="hub2-destination"
              {...(d.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <div className="hub2-destination-icon" aria-hidden="true">{d.emoji}</div>
              <div className="hub2-destination-body">
                <div className="hub2-destination-title">{d.title}</div>
                <div className="hub2-destination-sub">{d.sub}</div>
              </div>
              <div className="hub2-destination-arrow" aria-hidden="true">{d.external ? "↗" : "→"}</div>
            </a>
          ))}
        </div>

        {/* Feedback */}
        <div className="hub2-section-head">
          <div className="hub2-section-title">Feedback</div>
        </div>
        <div className="hub2-feedback">
          {feedback.map((f) => (
            <Link key={f.id} href={f.href} className="hub2-feedback-btn">
              <span className="hub2-feedback-icon" aria-hidden="true">{f.emoji}</span>
              <span className="hub2-feedback-label">{f.label}</span>
              <span className="hub2-feedback-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
