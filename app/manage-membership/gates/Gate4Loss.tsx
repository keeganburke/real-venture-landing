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
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Real cancellation: Whop cancels at period end, then we land the member back
  // on /manage-membership with a confirmation banner. No off-site redirect.
  const quit = async () => {
    if (cancelling) return;
    setCancelling(true);
    setError(null);
    onProceedToCancel();

    try {
      const res = await fetch("/api/whop/cancel", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error("cancel failed");

      const endsAt = typeof data.ends_at === "string" ? data.ends_at : null;
      // Fire and forget, keepalive so it survives the navigation below.
      fetch("/api/cancel-events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          event_type: "whop_cancel_completed",
          session_id: crypto.randomUUID(),
          event_data: { ends_at: endsAt },
        }),
      }).catch(() => {});

      window.location.href = `/manage-membership?cancelled=1${
        endsAt ? `&ends=${encodeURIComponent(endsAt)}` : ""
      }`;
    } catch {
      setError(
        "Something went wrong. Please try again or contact support at realventureestate@gmail.com."
      );
      setCancelling(false);
    }
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
      <button className="cf-btn-quit" onClick={quit} disabled={cancelling}>
        {cancelling ? "Cancelling\u2026" : "I'd rather quit, cancel my membership"}
      </button>
      {error && (
        <p
          role="alert"
          style={{
            marginTop: 12,
            textAlign: "center",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--red)",
          }}
        >
          {error}
        </p>
      )}
    </>
  );
}
