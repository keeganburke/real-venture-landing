"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

// Founder photos live in public/founders/ (keegan.png, will.jpg). There is no
// public/images/keegan-thumb.png or public/will-pfp.jpg in this repo.
const KEEGAN_SRC = "/founders/keegan.png";
const WILLIAM_SRC = "/founders/will.jpg";

type Step = {
  anchor: string | null; // CSS selector; null = no highlight, card centered
  narrator: "keegan" | "william" | "both";
  name: string;
  title: string;
  body: string;
  important?: boolean; // renders the red IMPORTANT pill above the title
};

const STEPS: Step[] = [
  { anchor: ".hub2-greeting", narrator: "both", name: "Keegan + William",
    title: "Welcome to Real Venture",
    body: "You're in. We're gonna walk you through everything real quick." },
  { anchor: ".hub2-hero", narrator: "william", name: "William Lynch",
    title: "Continue where you left off",
    body: "This is your next lesson. Every day, come back and knock out one more." },
  { anchor: ".sprint-card", narrator: "keegan", name: "Keegan Burke",
    title: "Your 14-Day First Deal Sprint",
    body: "Follow these 7 steps in order. Most members get to their first offer under 2 weeks." },
  { anchor: ".hub2-discord", narrator: "william", name: "William Lynch",
    title: "Join the community",
    body: "This is where you talk to us and join the calls 7 days a week. Very important to join.",
    important: true },
  { anchor: ".hub2-studio", narrator: "keegan", name: "Keegan Burke",
    title: "Real Venture Studio",
    body: "Deal analyzer, buyer list, contract gen. Everything to run your business." },
  { anchor: "[data-tour='livestreams']", narrator: "william", name: "William Lynch",
    title: "Live coaching all week",
    body: "Calls 7 days a week. Bring a deal or a question, get it answered live." },
  { anchor: "[data-tour='tile-courses']", narrator: "william", name: "William Lynch",
    title: "Full curriculum",
    body: "Every lesson from beginner to advanced. Structured, not scattered." },
  { anchor: "[data-tour='tile-resources']", narrator: "keegan", name: "Keegan Burke",
    title: "Tools",
    body: "Contracts, scripts, calculators. Everything you need to send offers today." },
  { anchor: null, narrator: "both", name: "Keegan + William",
    title: "You got this",
    body: "Any question, any bug - hit these buttons. We read every one. Now go close a deal." },
];

export default function SpotlightTour({ onComplete }: { onComplete: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const doneRef = useRef(false);

  const step = STEPS[stepIdx];

  const complete = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    try {
      await fetch("/api/tour/complete", { method: "POST" });
    } catch {
      // Non-fatal: the tour just shows again next visit.
    }
    onComplete();
  };

  // Position the spotlight over the current anchor. A null anchor is the
  // closing step: nothing is highlighted and the card sits centered, so there
  // is no rect to measure.
  useEffect(() => {
    if (step.anchor === null) {
      setRect(null);
      return;
    }
    const anchor = step.anchor;
    const el = document.querySelector(anchor) as HTMLElement | null;
    if (!el) {
      // Anchor missing (dismissed promo card, completed curriculum). Skip
      // forward so the tour never sits on a step it cannot show; if the
      // missing one is last, finish instead of stalling on a stale rect.
      console.warn("[tour] anchor not found:", step.anchor);
      if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
      else void complete();
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Wait for scroll to finish before measuring.
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      setRect(el.getBoundingClientRect());
    }, 400);

    const onResize = () => {
      const e = document.querySelector(anchor) as HTMLElement | null;
      if (e) setRect(e.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, step.anchor]);

  const skip = () => void complete();
  const next = () => {
    if (stepIdx === STEPS.length - 1) void complete();
    else setStepIdx(stepIdx + 1);
  };
  const back = () => setStepIdx(Math.max(0, stepIdx - 1));

  const centered = step.anchor === null;
  if (!centered && !rect) return null;

  // Spotlight positioning with 12px padding around anchor.
  const pad = 12;
  const spotStyle: React.CSSProperties = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : {};

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Dimmed backdrop. Anchored steps cut a hole out of it with the
          box-shadow trick; the closing step just dims the whole screen. */}
      {centered ? (
        <div className="tour-backdrop-full" />
      ) : (
        <div className="tour-backdrop" style={spotStyle} />
      )}

      {/* Bottom card */}
      <div className={`tour-card${centered ? " tour-card-center" : ""}`}>
        <div className="tour-avatars">
          {step.narrator === "both" ? (
            <>
              <span className="tour-avatar tour-avatar-back">
                <Image src={KEEGAN_SRC} alt="Keegan" width={56} height={56} />
              </span>
              <span className="tour-avatar tour-avatar-front">
                <Image src={WILLIAM_SRC} alt="William" width={56} height={56} />
              </span>
            </>
          ) : (
            <span className="tour-avatar tour-avatar-front">
              <Image
                src={step.narrator === "keegan" ? KEEGAN_SRC : WILLIAM_SRC}
                alt={step.name}
                width={56}
                height={56}
              />
            </span>
          )}
        </div>

        <div className="tour-name">{step.name.toUpperCase()}</div>
        {step.important && (
          <div className="tour-important-pill">
            <span className="tour-important-bang" aria-hidden="true">!</span>
            Important
          </div>
        )}
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-body">{step.body}</p>

        <div className="tour-dots" role="tablist" aria-label="Tour progress">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`tour-dot ${i === stepIdx ? "tour-dot-active" : ""}`}
              aria-current={i === stepIdx ? "step" : undefined}
            />
          ))}
        </div>

        <div className="tour-controls">
          <button type="button" className="tour-skip" onClick={skip}>Skip tour</button>
          <div className="tour-nav">
            {stepIdx > 0 && (
              <button type="button" className="tour-btn tour-btn-secondary" onClick={back}>Back</button>
            )}
            <button type="button" className="tour-btn tour-btn-primary" onClick={next}>
              {stepIdx === STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
