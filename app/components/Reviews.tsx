"use client";

import { useEffect, useState } from "react";
import type { WhopReview } from "../lib/whop-reviews";

const MOBILE_BATCH = 3;

// Deterministic gradient per username: hash the name to a hue so each member
// keeps a consistent avatar color across renders.
function gradientFromUsername(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${hue2} 72% 38%))`;
}

function ReviewCard({ review }: { review: WhopReview }) {
  const username = review.author.username;
  const stars = Math.max(1, Math.min(5, Math.round(review.rating)));
  return (
    <div className="lp-review-card">
      <div className="lp-review-header">
        <div className="lp-review-avatar" style={{ background: gradientFromUsername(username) }}>
          {(username[0] || "m").toUpperCase()}
        </div>
        <div>
          <div className="lp-review-name">{username}</div>
          <div className="lp-review-stars">{"★".repeat(stars)}</div>
        </div>
      </div>
      <p className="lp-review-text">{`"${review.content}"`}</p>
    </div>
  );
}

type Props = {
  reviews: WhopReview[];
  average: number;
  total: number;
};

export default function Reviews({ reviews }: Props) {
  // SSR and first paint render the mobile-style stack; the marquee needs a
  // client mount to know the viewport.
  const [desktop, setDesktop] = useState(false);
  const [shown, setShown] = useState(MOBILE_BATCH);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (desktop) {
    return (
      <div className="lp-reviews-marquee">
        <div className="lp-reviews-track">
          {[...reviews, ...reviews].map((review, i) => (
            <ReviewCard review={review} key={`${review.id}-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="lp-reviews-stack">
        {reviews.slice(0, shown).map((review) => (
          <ReviewCard review={review} key={review.id} />
        ))}
      </div>
      {shown < reviews.length && (
        <div className="lp-reviews-load-more">
          <button
            className="lp-reviews-load-more-btn"
            onClick={() => setShown((n) => n + MOBILE_BATCH)}
          >
            Load more reviews
          </button>
        </div>
      )}
    </>
  );
}
