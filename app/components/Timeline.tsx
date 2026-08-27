"use client";

import { useEffect, useRef } from "react";

// The 7-step wholesale path (labels render uppercase via CSS).
const STEPS = [
  {
    num: "01",
    icon: "🎯",
    label: "Step 1",
    title: "Find your buyer",
    desc: "Start with demand. Identify a buyer who's actively looking in your market before you touch a single deal.",
  },
  {
    num: "02",
    icon: "🔍",
    label: "Step 2",
    title: "Search for the house",
    desc: "Now you know what your buyer wants. Hunt for the property that matches their exact buy box.",
  },
  {
    num: "03",
    icon: "📊",
    label: "Step 3",
    title: "Analyze the deal",
    desc: "Pull comps, run the numbers through the analyzer, and know your max offer in under a minute.",
  },
  {
    num: "04",
    icon: "📞",
    label: "Step 4",
    title: "Call the seller",
    desc: "Use our proven scripts to get the seller on the phone and lock in the price.",
  },
  {
    num: "05",
    icon: "📝",
    label: "Step 5",
    title: "Generate contract",
    desc: "Auto-fill the contract with our templates. Send it to the seller and get it signed.",
  },
  {
    num: "06",
    icon: "🤝",
    label: "Step 6",
    title: "Assign it to buyer",
    desc: "Send the contract to your buyer for assignment. They handle the closing.",
  },
  {
    num: "07",
    icon: "💰",
    label: "Step 7",
    title: "Get paid and repeat",
    desc: "Collect your assignment fee at closing. Do it again. Scale from here.",
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
