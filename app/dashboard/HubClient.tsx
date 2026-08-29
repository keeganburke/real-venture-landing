"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WEEKLY_SCHEDULE } from "./hub-copy";
import type { Destination, FeedbackAction } from "./hub-copy";
import { getLiveCall, getNextCalls } from "./lib/next-calls";

const GREETINGS = [
  "Welcome back, {name}",
  "Back to the grind, {name}",
  "What are we doing today, {name}?",
  "Ready to close a deal, {name}?",
  "Good to see you, {name}",
  "Let's get to work, {name}",
  "Time to hunt, {name}",
  "Locked in, {name}?",
];

const GREETINGS_NO_NAME = [
  "Welcome back",
  "Back to the grind",
  "What are we doing today?",
  "Ready to close a deal?",
  "Good to see you",
  "Let's get to work",
  "Time to hunt",
  "Locked in?",
];

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
  destinations: Destination[];
  feedback: FeedbackAction[];
};

// Schedule times are Pacific wall-clock; render everything in LA terms so
// server timezone and viewer timezone never shift the labels.
const LA_TZ = "America/Los_Angeles";

function laDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    month: "short",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { month: get("month"), day: get("day"), weekday: get("weekday") };
}

function laDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabel(occursAt: Date) {
  const now = new Date();
  if (laDateKey(occursAt) === laDateKey(now)) return "Today";
  if (laDateKey(occursAt) === laDateKey(new Date(now.getTime() + 86400000))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: LA_TZ, weekday: "long" }).format(occursAt);
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

  const [discordDismissed, setDiscordDismissed] = useState(false);
  const [studioDismissed, setStudioDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("rv_discord_dismissed") === "1") setDiscordDismissed(true);
      if (localStorage.getItem("rv_studio_dismissed") === "1") setStudioDismissed(true);
    } catch {
      // localStorage unavailable; keep cards visible
    }
  }, []);

  // Random pick happens after mount so SSR and hydration render the same
  // default; the flip to a random phrase on load is expected.
  const [greetingIndex, setGreetingIndex] = useState(0);
  useEffect(() => {
    setGreetingIndex(Math.floor(Math.random() * GREETINGS.length));
  }, []);
  const greeting = displayName
    ? GREETINGS[greetingIndex].replace("{name}", displayName)
    : GREETINGS_NO_NAME[greetingIndex];

  const upcomingCalls = getNextCalls(WEEKLY_SCHEDULE, new Date(), 4);
  const liveCall = getLiveCall(WEEKLY_SCHEDULE);
  // A call in progress takes over the featured slot; otherwise next upcoming.
  const featuredEntry = liveCall
    ? { call: liveCall, occursAt: new Date() }
    : upcomingCalls[0];
  const featured = featuredEntry;
  const rest = liveCall ? upcomingCalls.slice(0, 3) : upcomingCalls.slice(1);
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

        {/* Greeting. Rotating phrase; personalized when a profile name exists. */}
        <header className="hub2-greeting">
          <h1 className="hub2-greeting-name">{greeting}{displayName ? " 👋" : ""}</h1>
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

        {/* Promoted cards: Discord + Studio. Dismissible via localStorage. */}
        {!discordDismissed && (
          <section className="hub2-discord">
            <button
              type="button"
              className="hub2-promo-dismiss"
              onClick={() => {
                localStorage.setItem("rv_discord_dismissed", "1");
                setDiscordDismissed(true);
              }}
              aria-label="Hide, I'm already in Discord"
            >
              ✕
            </button>
            <div className="hub2-discord-icon" aria-hidden="true">
              <svg
                className="hub2-discord-svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.086-2.157-2.42 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.419-2.157 2.419zm7.974 0c-1.181 0-2.156-1.086-2.156-2.42 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419Z"/>
              </svg>
            </div>
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
        )}

        {!studioDismissed && (
          <section className="hub2-studio">
            <button
              type="button"
              className="hub2-promo-dismiss"
              onClick={() => {
                localStorage.setItem("rv_studio_dismissed", "1");
                setStudioDismissed(true);
              }}
              aria-label="Hide, I'm already logged in"
            >
              ✕
            </button>
            <div className="hub2-studio-icon" aria-hidden="true">
              <img
                src="/rv-logo.png"
                alt="Real Venture"
                className="hub2-studio-logo"
                width={48}
                height={48}
              />
            </div>
            <div className="hub2-studio-title">Real Venture Studio</div>
            <p className="hub2-studio-sub">
              Deal analyzer, buyers, pipeline. Everything to run your business.
            </p>
            <a
              href="https://realventurestudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hub2-studio-cta"
            >
              <span>Enter the Studio</span>
              <span aria-hidden="true">↗</span>
            </a>
          </section>
        )}

        {/* Livestreams */}
        <div className="hub2-section-head">
          <div className="hub2-section-title">Livestreams</div>
          <Link href="/dashboard/livestreams" className="hub2-section-link">Full schedule →</Link>
        </div>

        {featured && (
          <div className="hub2-livestream">
            <div className="hub2-livestream-date">
              <div className="hub2-livestream-date-month">{laDay(featured.occursAt).month}</div>
              <div className="hub2-livestream-date-day">{laDay(featured.occursAt).day}</div>
            </div>
            <div className="hub2-livestream-body">
              <div className="hub2-livestream-label">
                <span className="hub2-livestream-pulse" aria-hidden="true"></span>
                {liveCall ? <span className="hub2-live-now">LIVE NOW</span> : dayLabel(featured.occursAt)}
                {liveCall && <span className="hub2-live-dot" aria-hidden="true"></span>}
              </div>
              <div className="hub2-livestream-title">{featured.call.type}</div>
              <div className="hub2-livestream-time">with {featured.call.host} · {featured.call.startTime} - {featured.call.endTime} PST</div>
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div className="hub2-upcoming">
            {rest.map(({ call, occursAt }) => {
              const d = laDay(occursAt);
              return (
                <div key={call.id} className="hub2-upcoming-row">
                  <div className="hub2-upcoming-day">
                    <div className="hub2-upcoming-day-name">{d.weekday}</div>
                    <div className="hub2-upcoming-day-num">{d.day}</div>
                  </div>
                  <div className="hub2-upcoming-body">
                    <div className="hub2-upcoming-title">{call.type}</div>
                    <div className="hub2-upcoming-time">with {call.host} · {call.startTime} - {call.endTime} PST</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Destinations */}
        <div className="hub2-destinations">
          {/* Studio is promoted to its own card above; keep the data entry, skip it here. */}
          {destinations.filter((d) => d.id !== "studio").map((d) => (
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
            <a
              key={f.id}
              href={f.href}
              className="hub2-feedback-btn"
              {...(f.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <span className="hub2-feedback-icon" aria-hidden="true">{f.emoji}</span>
              <span className="hub2-feedback-label">{f.label}</span>
              <span className="hub2-feedback-arrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>

      </div>
    </div>
  );
}
