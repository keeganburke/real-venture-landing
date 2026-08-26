"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// TODO: swap PLACEHOLDERS for real payout screenshot data later.
const PLACEHOLDERS = Array.from({ length: 10 }, (_, i) => i + 1);
const ADVANCE_MS = 7000;

export default function PayoutCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCurrentIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, ADVANCE_MS);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // Manual navigation advances immediately and resets the 7s auto-advance.
  const go = (delta: number) => {
    setCurrentIndex((i) => (i + delta + PLACEHOLDERS.length) % PLACEHOLDERS.length);
    startTimer();
  };

  return (
    <div className="lp-carousel">
      <button className="lp-carousel-arrow" onClick={() => go(-1)} aria-label="Previous payout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="lp-carousel-frame">
        {/* key remount restarts the slide+fade animation per card. CSS
            animation stands in for framer-motion, which is not in deps. */}
        <div className="lp-carousel-card" key={currentIndex}>
          <span className="lp-carousel-lbl">PAYOUT SCREENSHOT HERE</span>
        </div>
      </div>
      <button className="lp-carousel-arrow" onClick={() => go(1)} aria-label="Next payout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
