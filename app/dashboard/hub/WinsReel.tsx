"use client";

import { useEffect, useState } from "react";
import { PAYOUTS, type Payout } from "@/lib/payouts";

// Three payouts at a time, advancing three every 5 seconds. Same data as the
// landing marquee (lib/payouts.ts); startIdx 0 on both server and client so
// hydration matches.
export default function WinsReel() {
  const [startIdx, setStartIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStartIdx((i) => (i + 3) % PAYOUTS.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);
  const visible: Payout[] = [];
  for (let i = 0; i < 3; i++) {
    visible.push(PAYOUTS[(startIdx + i) % PAYOUTS.length]);
  }
  return (
    <div className="wins-reel">
      <div className="wins-reel-header">
        <span className="wins-reel-title">Wins this week</span>
        <span className="wins-reel-sub">Real members. Real payouts.</span>
      </div>
      <div className="wins-reel-cards">
        {visible.map((p) => (
          <div key={p.id} className="wins-reel-card">
            <img src={p.avatar} alt="" className="wins-reel-avatar" />
            <div className="wins-reel-body">
              <div className="wins-reel-name">{p.name}, {p.age}</div>
              <div className="wins-reel-amount">{p.amount}</div>
              <div className="wins-reel-blurb">{p.blurb}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
