"use client";

import { useEffect, useRef } from "react";

// Phase content carried over 1:1 from the old LP_PHASES cards.
const STEPS = [
  {
    num: "01",
    icon: "📚",
    label: "Phase 1 · Days 1-4",
    title: "Learn the fundamentals",
    desc: "Watch the course content and jump in the live streams. Get the framework locked before you touch a single deal.",
  },
  {
    num: "02",
    icon: "🔍",
    label: "Phase 2 · Days 5-9",
    title: "Analyze deals and find buyers",
    desc: "Start pulling comps and running deals through the analyzer. Build your buyer list. Take real action every day.",
  },
  {
    num: "03",
    icon: "💰",
    label: "Phase 3 · Days 10-14",
    title: "Send offers and get paid",
    desc: "Use the vetted contracts to send offers, lock up your first deal, and collect your assignment fee.",
  },
];

// HMHW-style scrolling timeline: the orb rides the rail with scroll progress,
// and the step closest to the viewport center gets .active. DOM class toggling
// (not state) keeps scroll handling out of the React render loop.
export default function Timeline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const orb = orbRef.current;
    if (!root || !orb) return;
    const rail = root.querySelector<HTMLElement>(".lp-timeline-rail");
    const steps = Array.from(root.querySelectorAll<HTMLElement>(".lp-timeline-step"));

    const onScroll = () => {
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (vh * 0.5 - rect.top) / rect.height));
      if (rail) {
        orb.style.top = `${progress * Math.max(0, rail.clientHeight - 26)}px`;
      }
      let best = 0;
      let bestDist = Infinity;
      steps.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - vh / 2);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      steps.forEach((el, i) => el.classList.toggle("active", i === best));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="lp-timeline" ref={rootRef}>
      <div className="lp-timeline-rail">
        <div className="lp-timeline-rail-line" />
        <div className="lp-timeline-orb" ref={orbRef} />
      </div>
      <div className="lp-timeline-steps">
        {STEPS.map((step, i) => (
          <div className="lp-timeline-step" data-step={i + 1} key={step.num}>
            <div className="lp-timeline-node">
              <div className="lp-timeline-num">{step.num}</div>
              <div className="lp-timeline-icon">{step.icon}</div>
            </div>
            <div className="lp-timeline-card">
              <div className="lp-timeline-label">{step.label}</div>
              <h3 className="lp-timeline-title">{step.title}</h3>
              <p className="lp-timeline-desc">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
