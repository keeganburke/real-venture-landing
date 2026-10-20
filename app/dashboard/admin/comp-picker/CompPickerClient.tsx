"use client";

import { useEffect, useState } from "react";
import { SUBJECT, COMPS } from "@/lib/comp-picker/scenario";
import { scoreComp } from "@/lib/comp-picker/scoring";
import type { CompProperty, CompVerdict } from "@/lib/comp-picker/types";
import CompPickerMap from "./CompPickerMap";
import CompBubble from "./CompBubble";
import "./comp-picker.css";

type Phase = "explainer" | "intro" | "playing";
type Guess = "good" | "bad";

export default function CompPickerClient() {
  const [phase, setPhase] = useState<Phase>("explainer");
  const [openCompId, setOpenCompId] = useState<string | null>(null);
  // Stores the TRUTH for each judged comp ("good" = really a good comp,
  // "bad" = really a bad comp), whatever button the user pressed. The map
  // pin shows reality; the bubble copy shows whether the guess was right.
  const [judgedComps, setJudgedComps] = useState<Record<string, Guess>>({});
  // What the user actually pressed, per comp.
  const [userGuesses, setUserGuesses] = useState<Record<string, Guess>>({});
  // Warm the browser cache with every photo during the intro so the bubble
  // never flashes black. Start is never blocked; this is best effort.
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    const urls = [SUBJECT.photoUrl, ...COMPS.map((c) => c.photoUrl)];
    let loaded = 0;
    const done = () => {
      if (++loaded >= urls.length) setImagesReady(true);
    };
    urls.forEach((url) => {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = url;
    });
    const timeout = setTimeout(() => setImagesReady(true), 3000);
    return () => clearTimeout(timeout);
  }, []);

  if (phase === "explainer") {
    return (
      <div className="comp-picker-intro">
        <h1 className="comp-picker-title">How comping works</h1>
        <p className="comp-picker-explainer-lead">
          Comping means finding houses just like yours that sold
          recently to figure out what yours is worth. You want to
          buy it for way less than that number so you can flip it
          and make money.
        </p>
        <p className="comp-picker-explainer-goal-line">
          <span className="comp-picker-explainer-goal-label">Your goal:</span>{" "}
          Pick the good comps. Skip the fake ones.
        </p>
        <button
          className="comp-picker-start-btn"
          onClick={() => setPhase("intro")}
        >
          Sounds good. Show me the house.
        </button>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="comp-picker-intro">
        <h1 className="comp-picker-title">Comp Picker</h1>
        <p className="comp-picker-sub">
          You will see this property and 6 sold houses nearby. 2 of them
          will not be good and 4 of them will be good. Your job is to
          find which 4 are the good ones.
        </p>
        <div className="comp-picker-subject-card">
          <img
            src={SUBJECT.photoUrl}
            alt={SUBJECT.address}
            className="comp-picker-subject-photo"
          />
          <div className="comp-picker-subject-details">
            <div className="comp-picker-subject-address">
              {SUBJECT.address}
            </div>
            <div className="comp-picker-subject-city">
              {SUBJECT.city}, {SUBJECT.state} {SUBJECT.zip}
            </div>
            <div className="comp-picker-subject-specs">
              {SUBJECT.beds} bd · {SUBJECT.baths} ba ·{" "}
              {SUBJECT.sqft.toLocaleString()} sqft
            </div>
          </div>
        </div>
        <button
          className="comp-picker-start-btn"
          onClick={() => setPhase("playing")}
        >
          Start
        </button>
        {!imagesReady && (
          <div className="comp-picker-preload-note">Loading comps...</div>
        )}
      </div>
    );
  }

  const openComp: CompProperty | null =
    openCompId !== null
      ? (COMPS.find((c) => c.id === openCompId) ?? null)
      : null;
  const openVerdict: CompVerdict | null = openComp
    ? scoreComp(SUBJECT, openComp)
    : null;

  const judgedCount = Object.keys(judgedComps).length;
  const allJudged = judgedCount === COMPS.length;

  return (
    <div className="comp-picker-play">
      <div className="comp-picker-instructions">
        Tap each comp on the map. {judgedCount}/{COMPS.length} judged.
      </div>
      <div className="comp-picker-map-wrap">
        <CompPickerMap
          subject={SUBJECT}
          comps={COMPS}
          judgedComps={judgedComps}
          onCompClick={(compId) => {
            // Already judged comps reopen on the verdict side for review.
            setOpenCompId(compId);
          }}
          onMapClick={() => setOpenCompId(null)}
          bubbleCompId={openCompId}
          bubbleContent={
            openComp && openVerdict ? (
              <CompBubble
                // Remount per comp so flip / typing state never carries over.
                key={openComp.id}
                comp={openComp}
                verdict={openVerdict}
                userGuess={userGuesses[openComp.id]}
                onJudge={(guess) => {
                  setUserGuesses((prev) => ({ ...prev, [openComp.id]: guess }));
                  setJudgedComps((prev) => ({
                    ...prev,
                    [openComp.id]: openVerdict.isGood ? "good" : "bad",
                  }));
                }}
                onClose={() => setOpenCompId(null)}
              />
            ) : null
          }
        />
      </div>
      {allJudged && (
        <div className="comp-picker-done">
          <div>All {COMPS.length} judged. Nice work.</div>
          <button
            className="comp-picker-start-btn"
            onClick={() => {
              setJudgedComps({});
              setUserGuesses({});
              setOpenCompId(null);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
