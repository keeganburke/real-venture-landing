"use client";

import { useEffect, useRef, useState } from "react";

// After a manual tap, the observer leaves that card alone for 5s so scroll
// auto-flip doesn't fight the user's choice.
const OVERRIDE_MS = 5000;
const CARD_COUNT = 6;

// Front copy carried over 1:1 from the old static LP_TOOLKIT grid.
const FRONTS = [
  {
    num: "01",
    title: "Live teaching",
    desc: "3x/week live calls with William + Keegan. Every deal reviewed, every question answered.",
    icon: '<path d="M23 7l-9.5 9.5-5-5L1 19"/><path d="M17 7h6v6"/>',
  },
  {
    num: "02",
    title: "Buyer network",
    desc: "Send your deals straight to our vetted buyer network. Skip the cold outreach.",
    icon: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  },
  {
    num: "03",
    title: "Deal analyzer",
    desc: "Any address, comps + ARV + max offer in under a minute. Never guess again.",
    icon: '<path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  },
  {
    num: "04",
    title: "Auto contracts",
    desc: "Fill your own contracts or use our templates. Send offers in minutes, not hours.",
    icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  },
  {
    num: "05",
    title: "Discord community",
    desc: "300+ members. 24/7 wins channel. Ask anything, get answers in minutes.",
    icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  },
  {
    num: "06",
    title: "14-day sprint",
    desc: "Structured 14-day path. Most members have a contract signed by day 14.",
    icon: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  },
];

const BUYERS = [
  { city: "Cleveland", deals: 14, hottest: true },
  { city: "Detroit", deals: 11, hottest: true },
  { city: "St Louis", deals: 8, hottest: false },
  { city: "Peoria", deals: 6, hottest: false },
];

const DISCORD_MSGS = [
  {
    user: "Badrobot",
    color: "#5865f2",
    time: "Today at 9:14 AM",
    text: "Just closed! $8,000 assignment 🎉🔥",
    reactions: [["❤️", 2], ["💯", 1]] as [string, number][],
    founder: false,
  },
  {
    user: "lance",
    color: "#23a55a",
    time: "Today at 9:31 AM",
    text: "6k wire hit this morning 💰",
    reactions: [["❤️", 3]] as [string, number][],
    founder: false,
  },
  {
    user: "William",
    color: "#E5B547",
    time: "Today at 9:40 AM",
    text: "Proud of you both. Who's next? 👀",
    reactions: [["💯", 2]] as [string, number][],
    founder: true,
  },
  {
    user: "Mello",
    color: "#eb459e",
    time: "Today at 10:02 AM",
    text: "offer accepted today!! 🙏",
    reactions: [["🔥", 1]] as [string, number][],
    founder: false,
  },
];

const SPRINT_DAYS = [
  { label: "Day 1", state: "done" },
  { label: "Day 2", state: "done" },
  { label: "Day 3", state: "done" },
  { label: "Day 5", state: "done" },
  { label: "Day 7", state: "done" },
  { label: "Day 10", state: "now" },
  { label: "Day 14", state: "dim" },
  { label: "Bonus", state: "dim" },
];

const LIVE_CHAT = [
  { user: "marcus", color: "#5865f2", text: "this is fire 🔥" },
  { user: "sara", color: "#eb459e", text: "taking notes rn" },
  { user: "devon", color: "#23a55a", text: "closing next week 💰" },
];

function BackVideo() {
  return (
    <>
      <div className="tkc-video-frame">
        <video autoPlay muted loop playsInline preload="metadata" src="/videos/william-loop.mp4" />
        <span className="tkc-live-badge">LIVE</span>
        <span className="tkc-viewers">
          <span className="tkc-viewers-dot" />
          35 members watching
        </span>
      </div>
      <div className="tkc-video-title">Calls 6x/week</div>
      <div className="tkc-live-chat">
        {LIVE_CHAT.map((msg, i) => (
          <div className={`tkc-live-msg tkc-live-m${i + 1}`} key={msg.user}>
            <span className="tkc-live-av" style={{ background: msg.color }} />
            <b>{msg.user}:</b> {msg.text}
          </div>
        ))}
      </div>
    </>
  );
}

function BackBuyer() {
  return (
    <>
      <div className="tkc-buyer-head">
        <span className="tkc-gold-dot" />
        6 hot buyer groups active
      </div>
      <div className="tkc-buyer-grid">
        {BUYERS.map((buyer) => (
          <div className={`tkc-buyer-tile${buyer.hottest ? " hottest" : ""}`} key={buyer.city}>
            {buyer.hottest && <span className="tkc-hottest">HOTTEST</span>}
            <div className="tkc-buyer-city">
              {buyer.city}
              <span className="tkc-online-dot" />
            </div>
            <div className="tkc-buyer-range">$0-250K · 70% ARV</div>
            <span className="tkc-deals">{buyer.deals} deals</span>
          </div>
        ))}
      </div>
      <div className="tkc-buyer-stats">
        <span className="tkc-buyer-stat tkc-bs1">42 buyer requests today</span>
        <span className="tkc-buyer-stat tkc-bs2">8 deals closed this week</span>
        <span className="tkc-buyer-stat tkc-bs3">$127K in fees paid this month</span>
      </div>
    </>
  );
}

function BackAnalyzer() {
  return (
    <>
      <div className="tkc-an-view tkc-an-input">
        <div className="tkc-an-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          Paste a Zillow URL
        </div>
        <div className="tkc-an-url">
          <span className="tkc-an-type">zillow.com/homes/123-main-st-springfield</span>
        </div>
        <div className="tkc-an-btn">Analyze Deal →</div>
      </div>
      <div className="tkc-an-view tkc-an-result">
        <div className="tkc-an-chips">
          <span>3bd</span>
          <span>2ba</span>
          <span>1,201 sqft</span>
          <span>Single Family</span>
        </div>
        <div className="tkc-an-score">Deal Score: 100</div>
        <div className="tkc-an-rows">
          <div className="tkc-an-row"><span>ARV</span><b>$185,000</b></div>
          <div className="tkc-an-row"><span>Repairs</span><b>$24,000</b></div>
          <div className="tkc-an-row"><span>Your Profit</span><b className="green">$15,000</b></div>
          <div className="tkc-an-row"><span>Max Offer</span><b>$133,000</b></div>
        </div>
        <div className="tkc-an-match">Buyer Matches: 2</div>
      </div>
    </>
  );
}

function BackContracts() {
  return (
    <>
      <div className="tkc-ct-view tkc-ct-form">
        <div className="tkc-ct-sec">SELLER · REQUIRED</div>
        <div className="tkc-ct-field tkc-ct-f1"><span>Seller Legal Name</span><b className="tkc-ct-val">John Smith</b></div>
        <div className="tkc-ct-field tkc-ct-f2"><span>Property Address</span><b className="tkc-ct-val">123 Main St, Springfield, IL</b></div>
        <div className="tkc-ct-field tkc-ct-f3"><span>Purchase Price</span><b className="tkc-ct-val">$133,000</b></div>
        <div className="tkc-ct-sec">BUYER · REQUIRED</div>
        <div className="tkc-ct-field tkc-ct-f4"><span>Buyer Legal Name</span><b className="tkc-ct-val">Real Venture Holdings LLC</b></div>
        <div className="tkc-ct-field tkc-ct-f5"><span>Assignment Fee</span><b className="tkc-ct-val">$15,000</b></div>
      </div>
      <div className="tkc-ct-view tkc-ct-done">
        <div className="tkc-ct-doc">
          <div className="tkc-ct-doc-title">PURCHASE AGREEMENT</div>
          <div className="tkc-ct-doc-line">Buyer: Real Venture Holdings</div>
          <div className="tkc-ct-doc-line">Property: 123 Main St</div>
          <div className="tkc-ct-doc-line">Price: $133,000</div>
          <div className="tkc-ct-sig-line">
            <span className="tkc-ct-sig">/s/ John Smith</span>
          </div>
        </div>
        <div className="tkc-ct-caption">Contract generated ✓</div>
      </div>
    </>
  );
}

function BackDiscord() {
  return (
    <>
      <div className="tkc-dc-head">
        <span><i>#</i> wins</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      </div>
      <div className="tkc-dc-msgs">
        {DISCORD_MSGS.map((msg, i) => (
          <div className={`tkc-dc-msg tkc-dc-m${i + 1}`} key={msg.user}>
            <span className="tkc-dc-av" style={{ background: msg.color }}>
              {msg.user[0].toUpperCase()}
            </span>
            <div className="tkc-dc-body">
              <div className="tkc-dc-meta">
                <b style={{ color: msg.founder ? "#E5B547" : "#dbdee1" }}>{msg.user}</b>
                <span>{msg.time}</span>
              </div>
              <div className="tkc-dc-text">{msg.text}</div>
              <div className="tkc-dc-reactions">
                {msg.reactions.map(([emoji, count]) => (
                  <span key={emoji}>
                    {emoji} {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div className="tkc-dc-typing">
          <span className="tkc-dc-dots"><i /><i /><i /></span>
          @keegan is typing…
        </div>
      </div>
      <div className="tkc-dc-input">Message #wins</div>
    </>
  );
}

function BackSprint({ count }: { count: number }) {
  return (
    <>
      <div className="tkc-sp-head">
        <span className="tkc-sp-rocket">🚀</span>
        <div>
          <div className="tkc-sp-title">First Deal Sprint</div>
          <div className="tkc-sp-sub">Follow in order</div>
        </div>
        <span className="tkc-sp-badge">{count}/7</span>
      </div>
      <div className="tkc-sp-bar">
        <span className="tkc-sp-fill" />
      </div>
      <div className="tkc-sp-grid">
        {SPRINT_DAYS.map((day) => (
          <div className={`tkc-sp-day ${day.state}`} key={day.label}>
            <span className="tkc-sp-day-lbl">{day.label}</span>
            {day.state === "done" && <span className="tkc-sp-check">✓</span>}
            {day.state === "now" && <span className="tkc-sp-now">NOW</span>}
          </div>
        ))}
      </div>
      <div className="tkc-sp-line">You are on Day 10 · Send your first 10 offers</div>
      <div className="tkc-sp-stat">Members hitting Day 14 → $0 → $15K avg assignment</div>
    </>
  );
}

export default function ToolkitCards() {
  const [flipped, setFlipped] = useState<boolean[]>(() => Array(CARD_COUNT).fill(false));
  const [sprintCount, setSprintCount] = useState(0);
  const [hoverCapable, setHoverCapable] = useState(false);
  const overrideUntil = useRef<number[]>(Array(CARD_COUNT).fill(0));
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Desktop (hover: hover) vs touch split; tracks mid-session input changes.
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    const update = () => setHoverCapable(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Scroll auto-flip is touch-only. Desktop flips purely on hover: the CSS
  // :hover rule turns the card, and mouseenter/leave mirrors the state into
  // .flipped because every back animation (and the sprint counter) keys off it.
  useEffect(() => {
    if (hoverCapable) {
      setFlipped(Array(CARD_COUNT).fill(false));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.idx);
          if (Number.isNaN(idx) || Date.now() < overrideUntil.current[idx]) continue;
          const shouldFlip = entry.isIntersecting;
          setFlipped((prev) =>
            prev[idx] === shouldFlip ? prev : prev.map((f, i) => (i === idx ? shouldFlip : f))
          );
        }
      },
      // Observation zone is the top 15% of the viewport: cards flip as they
      // cross the top edge, while the user is still reading them.
      { threshold: 0, rootMargin: "0% 0px -85% 0px" }
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [hoverCapable]);

  // Sprint badge counts 0 -> 5 while the card flips in; resets when it flips back.
  const sprintFlipped = flipped[5];
  useEffect(() => {
    if (!sprintFlipped) {
      setSprintCount(0);
      return;
    }
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setSprintCount(n);
      if (n >= 5) window.clearInterval(id);
    }, 260);
    return () => window.clearInterval(id);
  }, [sprintFlipped]);

  const tap = (idx: number) => {
    overrideUntil.current[idx] = Date.now() + OVERRIDE_MS;
    setFlipped((prev) => prev.map((f, i) => (i === idx ? !f : f)));
  };

  const setHover = (idx: number, on: boolean) => {
    setFlipped((prev) => (prev[idx] === on ? prev : prev.map((f, i) => (i === idx ? on : f))));
  };

  const backs = [
    { hook: "card-back-video", node: <BackVideo /> },
    { hook: "card-back-buyer", node: <BackBuyer /> },
    { hook: "card-back-analyzer", node: <BackAnalyzer /> },
    { hook: "card-back-contracts", node: <BackContracts /> },
    { hook: "card-back-discord", node: <BackDiscord /> },
    { hook: "card-back-sprint", node: <BackSprint count={sprintCount} /> },
  ];

  return (
    <div className="toolkit-cards">
      {FRONTS.map((card, idx) => (
        <div
          className={`toolkit-card${flipped[idx] ? " flipped" : ""}`}
          key={card.num}
          data-idx={idx}
          ref={(el) => {
            cardRefs.current[idx] = el;
          }}
          onClick={hoverCapable ? undefined : () => tap(idx)}
          onMouseEnter={hoverCapable ? () => setHover(idx, true) : undefined}
          onMouseLeave={hoverCapable ? () => setHover(idx, false) : undefined}
        >
          <div className="toolkit-card-inner">
            <div className="toolkit-card-face toolkit-card-front">
              <div className="lp-tk-num">{card.num}</div>
              <div
                className="lp-tk-icn"
                dangerouslySetInnerHTML={{
                  __html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${card.icon}</svg>`,
                }}
              />
              <div className="lp-tk-title">{card.title}</div>
              <div className="lp-tk-desc">{card.desc}</div>
              <div className="tkc-front-hint">
                <span className="tkc-front-hint-lbl">
                  <span className="tkc-front-hint-dot" />
                  <span className="tkc-hint-tap">Tap to reveal</span>
                  <span className="tkc-hint-hover">Hover to see</span>
                </span>
                <span className="tkc-front-hint-arrow">→</span>
              </div>
            </div>
            <div className={`toolkit-card-face toolkit-card-back ${backs[idx].hook}`}>
              {backs[idx].node}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
