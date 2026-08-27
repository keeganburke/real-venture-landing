"use client";

import { useEffect, useState } from "react";
import reviews from "../reviews-manifest.json";

const MOBILE_BATCH = 3;

// Screenshot-based reviews: desktop (hover-capable) gets the infinite marquee,
// touch devices get a 3-at-a-time load-more stack. SSR renders the stack.
export default function Reviews() {
  const [hoverCapable, setHoverCapable] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MOBILE_BATCH);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    const update = () => setHoverCapable(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleLoadMore = () =>
    setVisibleCount((n) => Math.min(n + MOBILE_BATCH, reviews.length));

  if (hoverCapable) {
    return (
      <div className="lp-reviews-marquee">
        <div className="lp-reviews-track">
          {[...reviews, ...reviews].map((review, i) => (
            <div className="lp-review-img-card" key={i}>
              <img src={`/reviews/${review.file}`} alt={`Real Venture review ${(i % reviews.length) + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lp-reviews-stack">
      {reviews.slice(0, visibleCount).map((review, i) => (
        <div className="lp-review-img-card" key={i}>
          <img src={`/reviews/${review.file}`} alt={`Real Venture review ${i + 1}`} loading="lazy" />
        </div>
      ))}
      {visibleCount < reviews.length && (
        <button onClick={handleLoadMore} className="lp-reviews-load-more-btn">
          Load more reviews {"→"}
        </button>
      )}
    </div>
  );
}
