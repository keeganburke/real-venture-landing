"use client";
import Link from "next/link";
import { useState } from "react";

// COUNT semantics: DONE_THROUGH is how many milestones are complete.
// 0 = none done, 1 = day 1 done, 2 = days 1+2 done, etc.
// NOTE: Studio's /sprint uses INDEX semantics (done = i <= DONE_THROUGH),
// don't mix them up when Phase B wires real Supabase state.
const DONE_THROUGH = 1;

type Milestone = {
  day: number;
  title: string;
  desc: string;
  cta: string;
  href: string;
  external?: boolean;
};

const MILESTONES: Milestone[] = [
  { day: 1, title: "Watch: Wholesaling overview", desc: "The fast overview so the rest clicks. One lesson, that's it.", cta: "Start lesson", href: "/dashboard/learn" },
  { day: 2, title: "Introduce yourself in Discord", desc: "Post your market + goal. The people who post close faster.", cta: "Say hi", href: "/dashboard/discord-help" },
  { day: 3, title: "Run a deal", desc: "Plug any address into the Deal Analyzer and see if it's a deal.", cta: "Open Deal Analyzer", href: "https://realventurestudio.com/analyze", external: true },
  { day: 5, title: "Pull your first leads", desc: "Use the lead tools to find 10 motivated sellers in your market.", cta: "Find leads", href: "https://realventurestudio.com/buyers", external: true },
  { day: 7, title: "Send your first offers", desc: "Use the contract generator + proof of funds and make 10 offers.", cta: "Make offers", href: "https://realventurestudio.com/contracts/new", external: true },
  { day: 10, title: "Join a live call", desc: "Bring a deal or a question. This is where it all comes together.", cta: "See live schedule", href: "/dashboard/livestreams" },
  { day: 14, title: "Log your first win", desc: "Got a contract or a buyer? Log it, and watch what happens next.", cta: "Log my win", href: "#" },
];

export default function SprintCard() {
  const [expanded, setExpanded] = useState(false);

  const doneCount = MILESTONES.filter((_, i) => i < DONE_THROUGH).length;
  const pct = Math.round((doneCount / MILESTONES.length) * 100);
  const nextIndex = doneCount;

  return (
    <section className="sprint-card">
      <button
        type="button"
        className="sprint-card-head"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="sprint-card-icon">🚀</div>
        <div className="sprint-card-head-body">
          <div className="sprint-card-title">
            Your 14-Day First Deal Sprint
            <span className="sprint-card-count">{doneCount}/{MILESTONES.length}</span>
          </div>
          <div className="sprint-card-subtitle">
            Follow these steps in order. Most members get to their first offer in under 2 weeks.
          </div>
          <div className="sprint-card-progress">
            <div className="sprint-progress-bar">
              <div className="sprint-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="sprint-card-chevron" aria-hidden="true">
          {expanded ? "▲" : "▼"}
        </div>
      </button>

      {expanded && (
        <div className="sprint-milestones">
          {MILESTONES.map((m, i) => {
            const done = i < DONE_THROUGH;
            const isNext = i === nextIndex;
            const cls = `sprint-milestone ${done ? "done" : ""} ${isNext ? "now" : ""}`.trim();

            return (
              <div key={m.day} className={cls}>
                <div className="sprint-check"><span className="sprint-check-mark">✓</span></div>
                <div className="sprint-day-badge">
                  <span className="sprint-day-label">DAY</span>
                  <span className="sprint-day-num">{m.day}</span>
                </div>
                <div className="sprint-m-body">
                  <div className="sprint-m-title">
                    {m.title}
                    {isNext && <span className="sprint-now-dot">NOW</span>}
                  </div>
                  <div className="sprint-m-desc">{m.desc}</div>
                </div>
                {m.external ? (
                  <a href={m.href} target="_blank" rel="noopener noreferrer" className="sprint-cta">{m.cta}</a>
                ) : (
                  <Link href={m.href} className="sprint-cta">{m.cta}</Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
