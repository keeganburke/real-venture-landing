"use client";

import Link from "next/link";

type Milestone = {
  day: number;
  title: string;
  desc: string;
  cta: string;
  href: string;
  external?: boolean;
};

// COUNT semantics: DONE_THROUGH is how many milestones are complete.
// 0 = none done, 1 = day 1 done, 2 = days 1 and 2 done.
//
// NOTE: Studio's /sprint uses INDEX semantics (done = i <= DONE_THROUGH), so
// the same constant means different things in the two repos. Do not port that
// comparison over when Phase B swaps this for a Supabase read.
const DONE_THROUGH = 1;

const MILESTONES: Milestone[] = [
  {
    day: 1,
    title: "Watch: Wholesaling overview",
    desc: "The fast overview so the rest clicks. One lesson, that's it.",
    cta: "Start lesson",
    // TODO(phase-b): deep link the orientation lesson once its slug is fixed.
    href: "/dashboard/learn",
  },
  {
    day: 2,
    title: "Introduce yourself in Discord",
    desc: "Post your market + goal. The people who post close faster.",
    cta: "Say hi",
    href: "/dashboard/discord-help",
  },
  {
    day: 3,
    title: "Run a deal",
    desc: "Plug any address into the Deal Analyzer and see if it's a deal.",
    cta: "Open Deal Analyzer",
    href: "https://realventurestudio.com/analyze",
    external: true,
  },
  {
    day: 5,
    title: "Pull your first leads",
    desc: "Use the lead tools to find 10 motivated sellers in your market.",
    cta: "Find leads",
    href: "https://realventurestudio.com/buyers",
    external: true,
  },
  {
    day: 7,
    title: "Send your first offers",
    desc: "Use the contract generator + proof of funds and make 10 offers.",
    cta: "Make offers",
    href: "https://realventurestudio.com/contracts/new",
    external: true,
  },
  {
    day: 10,
    title: "Join a live call",
    desc: "Bring a deal or a question. This is where it all comes together.",
    cta: "See live schedule",
    href: "/dashboard/livestreams",
  },
  {
    day: 14,
    title: "Log your first win",
    desc: "Got a contract or a buyer? Log it — and watch what happens next.",
    cta: "Log my win",
    // TODO(backlog): Log a Win feature does not exist yet.
    href: "#",
  },
];

export default function SprintClient() {
  const doneCount = MILESTONES.filter((_, i) => i < DONE_THROUGH).length;
  const pct = Math.round((doneCount / MILESTONES.length) * 100);
  const nextIndex = doneCount; // first incomplete

  return (
    <div className="hub2-page">
      <div className="hub2-shell">

        <nav className="hub2-nav">
          <Link href="/dashboard" className="hub2-menu">← Back to hub</Link>
        </nav>

        <header className="sprint-header">
          <div className="sprint-header-icon" aria-hidden="true">🚀</div>
          <div className="sprint-header-content">
            <h1>Your 14-Day First Deal Sprint</h1>
            <p>Follow these steps in order — most members get to their first offer in under 2 weeks.</p>
          </div>
          {/* Phase A: all three counters are hardcoded zeros. Phase B wires
              streak, lesson progress, and wins. */}
          <div className="sprint-header-stats">
            <span className="sprint-stat"><span aria-hidden="true">🔥</span> 0</span>
            <span className="sprint-stat"><span aria-hidden="true">🎓</span> 0/13</span>
            <span className="sprint-stat"><span aria-hidden="true">🏆</span> 0</span>
          </div>
          <div className="sprint-progress-row">
            <div className="sprint-progress-bar">
              <div className="sprint-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="sprint-progress-text">{doneCount} of {MILESTONES.length}</span>
          </div>
        </header>

        <div className="sprint-milestones">
          {MILESTONES.map((m, i) => {
            const done = i < DONE_THROUGH;
            const isNext = i === nextIndex;
            const cls = `sprint-milestone ${done ? "done" : ""} ${isNext ? "now" : ""}`.trim();

            return (
              <div key={m.day} className={cls}>
                <div className="sprint-check">
                  <span className="sprint-check-mark" aria-hidden="true">✓</span>
                </div>
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
                {/* A dynamic tag (m.external ? "a" : Link) does not typecheck:
                    the two element types have no compatible call signature. */}
                {m.external ? (
                  <a
                    href={m.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sprint-cta"
                  >
                    {m.cta}
                  </a>
                ) : (
                  <Link href={m.href} className="sprint-cta">
                    {m.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Visual only in Phase A: no state, no persistence. Phase C wires it. */}
        <div className="sprint-hide-row">
          <button className="sprint-hide-btn" type="button">× Hide the sprint</button>
        </div>

      </div>
    </div>
  );
}
