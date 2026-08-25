"use client";

import { NEXT_LIVE } from "../hub-copy";

export default function NextLiveRow() {
  return (
    <div className="next-live">
      <span className="nl-cal">{"\u{1F4C5}"}</span> Next:{" "}
      <span className="nl-time">{NEXT_LIVE.time}</span> {NEXT_LIVE.host}
      <button className="nl-btn">{NEXT_LIVE.button}</button>
    </div>
  );
}
