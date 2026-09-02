"use client";

import { useEffect, useRef, useState } from "react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";

// Base plan. Every trap point in the demo uses this one plan id, matching the
// pricing modal's Base tier (LandingClient PLANS.base).
const BASE_PLAN_ID = "plan_2NqC2WJzV87QY";

type SceneName = "hub" | "analyzer" | "buyers" | "contracts" | "learn" | "discord";
type ViewMode = "scene" | "checkout";

const SCENES: SceneName[] = ["hub", "analyzer", "buyers", "contracts", "learn", "discord"];

type Props = {
  open: boolean;
  onClose: () => void;
  // "Skip to pricing" needs a real destination: there is no #pricing anchor on
  // the page, so the host hands us the pricing modal opener instead.
  onSkipToPricing?: () => void;
};

/* ── Inline icons. The Studio's icon library is not a dependency here, so
      these are hand-traced equivalents of the icons DealDetailPanel and the
      contract picker use. ───────────────────────────────────────────────── */

type IconProps = { className?: string };
const svgBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function TrendingUpIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
function WrenchIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function DollarSignIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function MessageSquareIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function UsersIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function BanknoteIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01" />
      <path d="M18 12h.01" />
    </svg>
  );
}
function HandshakeIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87" />
      <path d="M3 4h8" />
      <path d="M3 6 2 14l6.5 6.5a1 1 0 1 0 3-3" />
    </svg>
  );
}
function ArrowRightLeftIcon({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className} aria-hidden="true">
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

export default function ProductDemo({ open, onClose, onSkipToPricing }: Props) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [view, setView] = useState<ViewMode>("scene");
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Every scene starts at its own top. The overlay is fullscreen, so this is
  // the internal scroll container, not the window.
  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [sceneIdx, view]);

  // Scroll lock + Esc, same pattern as the pricing modal in LandingClient.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentScene = SCENES[sceneIdx];
  const isLast = sceneIdx === SCENES.length - 1;

  const goNext = () => {
    if (!isLast) setSceneIdx(sceneIdx + 1);
  };
  const goBack = () => {
    if (sceneIdx > 0) setSceneIdx(sceneIdx - 1);
  };
  const trapToCheckout = () => setView("checkout");
  const closeAll = () => {
    setSceneIdx(0);
    setView("scene");
    onClose();
  };
  const skipToPricing = () => {
    closeAll();
    onSkipToPricing?.();
  };

  if (!open) return null;

  return (
    <div className="demo-page" role="dialog" aria-modal="true" aria-label="Product demo">
      <div className="demo-topbar">
        <div className="demo-progress">
          {SCENES.map((name, i) => (
            <span
              key={name}
              className={`demo-dot ${i === sceneIdx ? "demo-dot-active" : ""} ${i < sceneIdx ? "demo-dot-done" : ""}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <button className="demo-close" onClick={closeAll} aria-label="Close demo">×</button>
      </div>

      <div className="demo-viewport" ref={viewportRef}>
        {view === "checkout" ? (
          <CheckoutScene onBack={() => setView("scene")} />
        ) : (
          <>
            {currentScene === "hub" && <HubScene />}
            {currentScene === "analyzer" && <AnalyzerScene />}
            {currentScene === "buyers" && <BuyersScene />}
            {currentScene === "contracts" && <ContractsScene />}
            {currentScene === "learn" && <LearnScene />}
            {currentScene === "discord" && <DiscordScene />}
          </>
        )}
      </div>

      {view === "scene" && (
        <div className="demo-footer">
          <div className="demo-nav">
            {sceneIdx > 0 && (
              <button className="demo-btn demo-btn-ghost" onClick={goBack}>Back</button>
            )}
            {!isLast && (
              <button className="demo-btn demo-btn-primary" onClick={goNext}>Next →</button>
            )}
            {isLast && (
              <button className="demo-btn demo-btn-gold" onClick={trapToCheckout}>
                Get in for $19.99/mo →
              </button>
            )}
          </div>
          <button type="button" className="demo-skip" onClick={skipToPricing}>
            Skip to pricing →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Scene chrome ─────────────────────────────────────────────────────────── */

function SceneHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <div className="demo-scene-label">{eyebrow}</div>
      <h2 className="demo-scene-title">{title}</h2>
    </>
  );
}

/* ── SCENE 1 · HUB ────────────────────────────────────────────────────────
   Real .hub2-* markup lifted from app/dashboard/HubClient.tsx. The schedule is
   frozen: HubClient derives it from new Date() in America/Los_Angeles, which
   would hydrate-mismatch here. */

const DEMO_UPCOMING = [
  { weekday: "Wed", day: "2", type: "Live Cold Call Session", host: "Dylan", time: "6:00 PM - 7:00 PM PST" },
  { weekday: "Thu", day: "3", type: "Live Buyer Outreach", host: "Marco", time: "11:00 AM - 1:00 PM PST" },
  { weekday: "Thu", day: "3", type: "Live Deal Underwriting", host: "Brandon, Mello, Ady", time: "4:00 PM - 6:00 PM PST" },
];

function HubScene() {
  return (
    <section className="demo-scene demo-scene-hub">
      <SceneHead eyebrow="01 · YOUR HUB" title="This is what you log into." />

      <div className="demo-hub-frame">
        <header className="hub2-greeting">
          <h1 className="hub2-greeting-name">Locked in?</h1>
          <p className="hub2-greeting-sub">
            13 lessons, 7 live calls a week, and a room full of people closing deals. Let&apos;s go.
          </p>
        </header>

        <section className="hub2-hero">
          <div className="hub2-hero-course">Foundations · Lesson 1 of 3</div>
          <div className="hub2-hero-title">Orientation &amp; Expectations</div>
          <span className="hub2-hero-cta">
            <span>Continue lesson</span>
            <span className="hub2-hero-cta-arrow" aria-hidden="true">→</span>
          </span>
        </section>

        <div className="hub2-section-head">
          <div className="hub2-section-title">Livestreams</div>
          <span className="hub2-section-link">Full schedule →</span>
        </div>

        <div className="hub2-livestream">
          <div className="hub2-livestream-date">
            <div className="hub2-livestream-date-month">Sep</div>
            <div className="hub2-livestream-date-day">2</div>
          </div>
          <div className="hub2-livestream-body">
            <div className="hub2-livestream-label">
              <span className="hub2-livestream-pulse" aria-hidden="true"></span>
              TOMORROW
            </div>
            <div className="hub2-livestream-title">Live Coaching</div>
            <div className="hub2-livestream-time">with William · 4:00 PM - 5:00 PM PST</div>
          </div>
        </div>

        <div className="hub2-upcoming">
          {DEMO_UPCOMING.map((c) => (
            <div key={`${c.weekday}-${c.type}`} className="hub2-upcoming-row">
              <div className="hub2-upcoming-day">
                <div className="hub2-upcoming-day-name">{c.weekday}</div>
                <div className="hub2-upcoming-day-num">{c.day}</div>
              </div>
              <div className="hub2-upcoming-body">
                <div className="hub2-upcoming-title">{c.type}</div>
                <div className="hub2-upcoming-time">with {c.host} · {c.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="hub2-destinations">
          <div className="hub2-destination">
            <div className="hub2-destination-icon" aria-hidden="true">📚</div>
            <div className="hub2-destination-body">
              <div className="hub2-destination-title">Course library</div>
              <div className="hub2-destination-sub">All 13 lessons, start to finish</div>
            </div>
            <div className="hub2-destination-arrow" aria-hidden="true">→</div>
          </div>
          <div className="hub2-destination">
            <div className="hub2-destination-icon" aria-hidden="true">💰</div>
            <div className="hub2-destination-body">
              <div className="hub2-destination-title">Tools</div>
              <div className="hub2-destination-sub">Contracts, scripts, checklists</div>
            </div>
            <div className="hub2-destination-arrow" aria-hidden="true">→</div>
          </div>
        </div>
      </div>

    </section>
  );
}

/* ── SCENE 2 · DEAL ANALYZER ──────────────────────────────────────────────
   Translated from Studio DealDetailPanel.tsx L1043-1169. Tailwind utilities
   became .demo-an-* rules; .rv-glass-panel became .demo-glass. Glow values
   are preserved verbatim. */

function AnalyzerScene() {
  return (
    <section className="demo-scene demo-scene-analyzer">
      <SceneHead eyebrow="02 · DEAL ANALYZER" title="Any address → max offer in 30 seconds." />

      <div className="demo-an-stack">
        {/* Deal score hero */}
        <div className="demo-glass demo-glass-green demo-an-score">
          <p className="demo-an-score-lbl">Deal Score</p>
          <p
            className="demo-an-score-num"
            style={{ textShadow: "0 0 18px rgba(74,222,128,0.50), 0 0 36px rgba(74,222,128,0.25)" }}
          >
            100
          </p>
          <p className="demo-an-score-verdict">
            Strong. Asking price is close to your number. This one has real potential.
          </p>
        </div>

        {/* ARV */}
        <div className="demo-an-arv">
          <div className="demo-an-arv-icon">
            <TrendingUpIcon className="demo-an-ico" />
          </div>
          <div>
            <p className="demo-an-arv-lbl">Estimated ARV</p>
            <p className="demo-an-arv-val">$185,000</p>
          </div>
        </div>

        {/* Repairs */}
        <div className="demo-an-row">
          <div className="demo-an-row-left">
            <WrenchIcon className="demo-an-ico-sm demo-an-repairs" />
            <div>
              <p className="demo-an-row-lbl demo-an-repairs">Repairs</p>
              <p className="demo-an-row-tier demo-an-repairs">Light</p>
            </div>
          </div>
          <p className="demo-an-row-val demo-an-repairs">$13,400</p>
        </div>

        {/* Your profit */}
        <div className="demo-an-row">
          <div className="demo-an-row-left">
            <DollarSignIcon className="demo-an-ico-sm demo-an-gold" />
            <div>
              <p className="demo-an-row-lbl demo-an-gold demo-an-strong">Your Profit on This Deal</p>
              <p className="demo-an-row-sub">Your assignment fee at closing</p>
            </div>
          </div>
          <p
            className="demo-an-row-val demo-an-gold"
            style={{ textShadow: "0 0 12px rgba(229,181,71,0.45), 0 0 24px rgba(229,181,71,0.22)" }}
          >
            $15,000
          </p>
        </div>

        {/* Max offer */}
        <div className="demo-glass demo-glass-green demo-an-mao">
          <p className="demo-an-mao-lbl">Max Allowable Offer (rounded down)</p>
          <p
            className="demo-an-mao-val"
            style={{ textShadow: "0 0 14px rgba(74,222,128,0.50), 0 0 28px rgba(74,222,128,0.25)" }}
          >
            $133,000
          </p>
          <p className="demo-an-mao-sub">70% ARV − repairs − fee</p>
        </div>

        {/* Outreach buttons */}
        <div className="demo-an-actions">
          <span className="demo-an-action"><PhoneIcon className="demo-an-ico-xs" />On-Market Script</span>
          <span className="demo-an-action"><PhoneIcon className="demo-an-ico-xs" />Off-Market Script</span>
          <span className="demo-an-action"><MessageSquareIcon className="demo-an-ico-xs" />Text Template</span>
          <span className="demo-an-action demo-an-action-gold">
            <UsersIcon className="demo-an-ico-xs" />Buyer Matches
            <span className="demo-an-count">2</span>
          </span>
        </div>
      </div>

    </section>
  );
}

/* ── SCENE 3 · BUYER DIRECTORY ────────────────────────────────────────────
   Copy is verbatim from Studio src/lib/markets.ts MARKET_NOTE_LIST; the five
   hottest match HOTTEST_CITIES in seedCityBuyers.ts. */

const DEMO_MARKETS = [
  { label: "Cleveland, OH", hot: true, note: "Low entry prices, heavy rental demand. Investors buy volume here.", deals: 14 },
  { label: "Detroit, MI", hot: true, note: "Heavy distressed inventory. Rehab-heavy but the spreads are wide.", deals: 22 },
  { label: "Peoria, IL", hot: true, note: "Small market, low competition. Cash flow buyers dominate.", deals: 11 },
  { label: "Decatur, IL", hot: true, note: "Cheap basis, straightforward deals. Good for first assignments.", deals: 8 },
  { label: "St Louis, MO", hot: true, note: "Big metro, deep investor bench. Neighborhood matters a lot here.", deals: 20 },
  { label: "Toledo, OH", hot: false, note: "Cheap doors, steady cash flow. Good first-deal market.", deals: 6 },
  { label: "Columbus, OH", hot: false, note: "Growing metro with a deep landlord base. Deals move.", deals: 9 },
  { label: "Akron, OH", hot: false, note: "Small-city pricing next to a major metro. Consistent buyer appetite.", deals: 7 },
];

function BuyersScene() {
  return (
    <section className="demo-scene demo-scene-buyers">
      <SceneHead
        eyebrow="03 · VETTED BUYER NETWORK"
        title="Send your deals to real cash buyers. Skip cold outreach."
      />

      <div className="demo-market-grid">
        {DEMO_MARKETS.map((m) => (
          <div
            key={m.label}
            className={`demo-market-card${m.hot ? " demo-market-card--hot" : ""}`}
          >
            <div className="demo-market-head">
              <h3 className="demo-market-city">{m.label}</h3>
              {m.hot && <span className="demo-hottest-badge">🔥 HOTTEST</span>}
            </div>
            <p className="demo-market-note">{m.note}</p>
            <p className="demo-market-deals">{m.deals} deals</p>
          </div>
        ))}
      </div>

    </section>
  );
}

/* ── SCENE 4 · CONTRACT GENERATOR ─────────────────────────────────────────
   Translated from Studio contracts/new/page.tsx L917-985. The two motion
   wrappers are plain divs here: this repo is CSS-animation only, no motion
   library. Labels come from contracts/templates/registry.ts, blurbs from
   TEMPLATE_BLURBS. */

const DEMO_CONTRACTS = [
  { key: "cash_purchase", label: "Cash Purchase and Sale Agreement", blurb: "Straight cash closing", Icon: BanknoteIcon },
  { key: "seller_finance", label: "Seller Finance Purchase Agreement", blurb: "Seller carryback financing terms", Icon: HandshakeIcon },
  { key: "assignment", label: "Assignment of Contract", blurb: "Assign your contract to an end buyer", Icon: ArrowRightLeftIcon },
  { key: "jv", label: "JV Agreement", blurb: "Split a wholesale fee with a partner", Icon: UsersIcon },
];

function ContractsScene() {
  return (
    <section className="demo-scene demo-scene-contracts">
      <SceneHead eyebrow="04 · CONTRACT GENERATOR" title="4 contract types. Pre-filled or DIY." />

      <div className="demo-contract-grid">
        {DEMO_CONTRACTS.map(({ key, label, blurb, Icon }, i) => {
          const selected = i === 0;
          return (
            <div
              key={key}
              className={`demo-contract-card${selected ? " demo-contract-card--selected" : ""}`}
            >
              <span className={`demo-contract-radio${selected ? " is-on" : ""}`} aria-hidden="true">
                {selected && <span className="demo-contract-radio-dot" />}
              </span>
              <div className={`demo-contract-icon${selected ? " is-on" : ""}`}>
                <Icon className="demo-an-ico" />
              </div>
              <p className="demo-contract-name">{label}</p>
              <p className="demo-contract-blurb">{blurb}</p>
            </div>
          );
        })}
      </div>

      <div className="demo-contracts-pro">
        <span className="demo-contracts-pro-tag">PRO</span>
        <span className="demo-contracts-pro-text">
          Contract Generator auto-fills every field. Upgrade to Pro for the full sauce.
        </span>
      </div>

    </section>
  );
}

/* ── SCENE 5 · COURSE LIBRARY ─────────────────────────────────────────────
   Real .learn-* markup from app/dashboard/learn/LearnClient.tsx. Lesson rows
   are static: the live page reads titles and progress from Supabase. */

type DemoLesson = { emoji: string; title: string; desc: string; time: string; state: "done" | "locked" | "pro" };

const DEMO_TIERS: { key: string; emoji: string; label: string; lessons: DemoLesson[] }[] = [
  {
    key: "beginner",
    emoji: "🌱",
    label: "Beginner",
    lessons: [
      { emoji: "🧭", title: "Orientation & Expectations", desc: "Set your goals and understand how to get the most out of Real Venture.", time: "8 min", state: "done" },
      { emoji: "🎯", title: "What Wholesaling Actually Is", desc: "Cut through the noise. Learn what wholesaling really is (and is not).", time: "12 min", state: "done" },
      { emoji: "⚖️", title: "Traditional vs Secured Wholesaling", desc: "The two paths. Why we teach secured wholesaling and what makes it different.", time: "10 min", state: "locked" },
    ],
  },
  {
    key: "intermediate",
    emoji: "💪",
    label: "Intermediate",
    lessons: [
      { emoji: "💎", title: "How to Find a Buyer", desc: "Start here. Build your buyer list before you touch a deal.", time: "18 min", state: "locked" },
      { emoji: "🏡", title: "On-market Strategy", desc: "Zillow, Redfin, MLS. Find deals in plain sight that others miss.", time: "22 min", state: "locked" },
      { emoji: "🔍", title: "Off-market Strategy", desc: "Cold outreach that actually converts. Scripts and systems.", time: "25 min", state: "locked" },
      { emoji: "📊", title: "Deal Analysis and Underwriting", desc: "Know your numbers cold. Comp, ARV, MAO in under 60 seconds.", time: "30 min", state: "locked" },
      { emoji: "🔒", title: "Acquisitions and Getting the Contract", desc: "Get the seller to sign. Objection handling + closing scripts.", time: "20 min", state: "locked" },
      { emoji: "📝", title: "How to Fill Out and Sign the Contract", desc: "Every field, every clause, explained.", time: "15 min", state: "locked" },
      { emoji: "🤝", title: "Dispositions and Selling the Contract", desc: "Assign it fast. Buyer outreach + earnest money handling.", time: "18 min", state: "locked" },
    ],
  },
  {
    key: "advanced",
    emoji: "🧠",
    label: "Advanced",
    lessons: [
      { emoji: "💵", title: "Title Work and Getting Paid", desc: "How the money moves. Title, closing, wire day.", time: "15 min", state: "pro" },
      { emoji: "🚀", title: "Reinvesting and Scaling", desc: "What to do with your first $10K. How to compound.", time: "20 min", state: "pro" },
      { emoji: "🏆", title: "Case Studies", desc: "Real deals, real numbers, dissected step by step.", time: "45 min", state: "pro" },
    ],
  },
];

function LearnScene() {
  return (
    <section className="demo-scene demo-scene-learn">
      <SceneHead eyebrow="05 · COURSE LIBRARY" title="13 lessons. From zero to your first close." />

      <div className="demo-learn-frame">
        <header className="learn-header">
          <h1 className="learn-title">Learn Wholesaling</h1>
          <p className="learn-sub">All 13 lessons, start to finish</p>
        </header>

        <div className="learn-stats-grid">
          <div className="learn-stat-card">
            <span className="learn-stat-icn">📚</span>
            <span className="learn-stat-num">15%</span>
            <span className="learn-stat-lbl">Course complete</span>
          </div>
          <div className="learn-stat-card">
            <span className="learn-stat-icn">🎓</span>
            <span className="learn-stat-num">2/13</span>
            <span className="learn-stat-lbl">Lessons completed</span>
          </div>
        </div>

        {DEMO_TIERS.map((tier) => (
          <section className="learn-section" key={tier.key}>
            <div className="learn-section-head">
              <span className="learn-section-emoji">{tier.emoji}</span>
              {tier.label}
            </div>
            <div className="learn-lesson-list">
              {tier.lessons.map((lesson, index) => {
                const done = lesson.state === "done";
                const pro = lesson.state === "pro";
                const cls = `learn-lesson-row${done ? " complete" : ""}${lesson.state === "locked" ? " locked" : ""}${pro ? " pro-gated" : ""}`;
                return (
                  <div
                    className={cls}
                    key={lesson.title}
                    style={{ "--i": String(index) } as React.CSSProperties}
                  >
                    <span className="learn-lesson-num" style={{ fontSize: 15 }}>
                      {done ? "✓" : lesson.emoji}
                    </span>
                    <span className="learn-lesson-body">
                      <span className="learn-lesson-title">
                        {lesson.title}
                        {pro && <span className="learn-pro-badge">🔒 PRO</span>}
                      </span>
                      <span className="learn-lesson-desc">{lesson.desc}</span>
                      <span className="learn-lesson-meta">{lesson.time}</span>
                    </span>
                    <span className="learn-lesson-arw">{done ? "→" : "🔒"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

    </section>
  );
}

/* ── SCENE 6 · DISCORD ────────────────────────────────────────────────────
   Real screenshots from the #wins channel, public/demo/discord/. */

const DEMO_SHOTS = [
  { src: "/demo/discord/ruby-perma.png", alt: "Ruby: I'm loving this program. Perma: It gets better and better." },
  { src: "/demo/discord/bgrizz-news.png", alt: "BGrizz: BIG NEWS TODAY, 2 buyers walking a property in Columbus" },
  { src: "/demo/discord/axel.png", alt: "Axel: appreciate y'all fr, this is so nice being around people who push each other" },
  { src: "/demo/discord/bgrizz-mello.png", alt: "BGrizz and Mello: YOU GOAT" },
  { src: "/demo/discord/mello-close.png", alt: "Mello: $2,350 first close story with deal analyzer screenshot" },
];

function DiscordScene() {
  return (
    <section className="demo-scene demo-scene-discord">
      <div className="demo-discord-shots">
        {DEMO_SHOTS.map((shot) => (
          <img key={shot.src} src={shot.src} alt={shot.alt} className="demo-discord-screenshot" />
        ))}
      </div>
    </section>
  );
}

/* ── CHECKOUT ─────────────────────────────────────────────────────────────── */

function CheckoutScene({ onBack }: { onBack: () => void }) {
  return (
    <section className="demo-scene demo-scene-checkout">
      <button className="demo-checkout-back" onClick={onBack}>← Back to demo</button>
      <div className="demo-checkout-frame">
        <h2 className="demo-scene-title demo-checkout-title">You&apos;ve seen inside. Ready?</h2>
        <p className="demo-checkout-sub">$19.99/mo · Cancel anytime</p>
        {/* Same props as the pricing modal's embed (LandingClient), Base plan. */}
        <WhopCheckoutEmbed
          planId={BASE_PLAN_ID}
          theme="dark"
          themeOptions={{
            backgroundColor: "#0f0f12",
            accentColor: "#E5A544",
            borderRadius: 12,
          }}
          skipRedirect
          onComplete={() => {
            window.location.href = "/login?justpurchased=1";
          }}
        />
      </div>
    </section>
  );
}
