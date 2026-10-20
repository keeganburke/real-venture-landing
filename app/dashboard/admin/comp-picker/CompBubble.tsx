"use client";

import { useState } from "react";
import type { CompProperty, CompVerdict } from "@/lib/comp-picker/types";
import CoachSpeech from "./CoachSpeech";

type Guess = "good" | "bad";

type Props = {
  comp: CompProperty;
  verdict: CompVerdict;
  userGuess: Guess | undefined;
  onJudge: (guess: Guess) => void;
  onClose: () => void;
};

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - then) / 86400000));
}

// Flip card anchored above a comp pin. Front: the property. Back: William's
// verdict. Picking Good / Bad flips it; a comp that was already judged opens
// straight on the back so the guess cannot be changed after the reveal.
export default function CompBubble({ comp, verdict, userGuess, onJudge, onClose }: Props) {
  const [flipped, setFlipped] = useState(userGuess !== undefined);

  const judge = (guess: Guess) => {
    onJudge(guess);
    setFlipped(true);
  };

  return (
    <div className={"comp-bubble" + (flipped ? " comp-bubble-flipped" : "")}>
      <div className="comp-bubble-face comp-bubble-front">
        <img src={comp.photoUrl} alt={comp.address} className="comp-bubble-photo" />
        <div className="comp-bubble-body">
          <div className="comp-bubble-header">
            <div className="comp-bubble-address" title={comp.address}>
              {comp.address}
            </div>
            <div className="comp-bubble-price-pill">${comp.salePrice.toLocaleString()}</div>
          </div>
          <div className="comp-bubble-city">
            {comp.city}, {comp.state} {comp.zip}
          </div>
          <div className="comp-bubble-pills">
            <span>{comp.beds} bd</span>
            <span>{comp.baths} ba</span>
            <span>{comp.sqft.toLocaleString()} sqft</span>
          </div>
          <div className="comp-bubble-sold">Sold {daysAgo(comp.soldDate)} days ago</div>
          <div className="comp-bubble-actions">
            <button type="button" className="comp-bubble-btn-good" onClick={() => judge("good")}>
              Good comp
            </button>
            <button type="button" className="comp-bubble-btn-bad" onClick={() => judge("bad")}>
              Bad comp
            </button>
          </div>
        </div>
      </div>

      <div className="comp-bubble-face comp-bubble-back">
        {userGuess !== undefined ? <CoachSpeech verdict={verdict} userGuess={userGuess} /> : null}
        <button type="button" className="comp-bubble-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
