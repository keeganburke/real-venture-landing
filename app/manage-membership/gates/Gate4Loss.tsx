"use client";

import { useEffect, useState } from "react";

const LOSS_FEATURES = [
  "Deal Analyzer",
  "Contract Generator",
  "Proof of Funds",
  "Buyer Network",
  "Live calls",
  "JV service",
  "Full curriculum",
  "Discord role",
  "All your progress",
  "Locked-in pricing",
];

// TODO: swap for real testimonials
const TESTIMONIALS = [
  {
    id: "marcus",
    quote:
      "Closed my first deal in 22 days. Never done anything like this before. The buyer network is what did it, they matched me in 3 hours.",
    attr: "Marcus T., closed $18,000 assignment fee",
  },
  {
    id: "sara",
    quote:
      "I was skeptical about paying monthly for education. Then I made 7x that on my first contract.",
    attr: "Sara R., closed $12,500 in month 2",
  },
  {
    id: "devon",
    quote:
      "The 14-day sprint got me a signed contract by day 11. Live calls are where I actually learn.",
    attr: "Devon K., 3 deals closed since joining",
  },
];

type Props = {
  onKeep: () => void;
  onTestimonialShown: (testimonialId: string, index: number) => void;
  onProceedToCancel: () => void;
};

export default function Gate4Loss({ onKeep, onTestimonialShown, onProceedToCancel }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    onTestimonialShown(TESTIMONIALS[index].id, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const testimonial = TESTIMONIALS[index];

  const quit = () => {
    onProceedToCancel();
    window.location.href = "https://whop.com";
  };

  return (
    <>
      <div className="cf-modal-eyeb left">Before you go</div>
      <div className="cf-loss-h">
        {"Here's what you "}
        <span>lose</span>
      </div>

      <div className="cf-loss-features">
        {LOSS_FEATURES.map((feature) => (
          <div className="cf-loss-feature" key={feature}>
            <span className="x">{"×"}</span>
            {feature}
          </div>
        ))}
      </div>

      <div className="cf-testimonial">
        <div className="cf-testimonial-eyeb">
          You know who <b>did</b> use them?
        </div>
        <div className="cf-testimonial-quote">{`"${testimonial.quote}"`}</div>
        <div className="cf-testimonial-attr">{testimonial.attr}</div>
      </div>

      <div className="cf-testimonial-dots">
        {TESTIMONIALS.map((t, i) => (
          <div className={`cf-tdot${i === index ? " on" : ""}`} key={t.id} />
        ))}
      </div>

      <button className="cf-btn-primary" onClick={onKeep}>
        Keep my plan
      </button>
      <button className="cf-btn-quit" onClick={quit}>
        {"I'd rather quit, cancel my membership"}
      </button>
    </>
  );
}
