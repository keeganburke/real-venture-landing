"use client";

import { useEffect, useState } from "react";
import type { CompVerdict } from "@/lib/comp-picker/types";

const WILLIAM_SRC = "/founders/will.jpg";
const TYPE_MS = 25;

type Props = {
  verdict: CompVerdict;
  userGuess: "good" | "bad";
};

// William's reaction to the guess. The headline lands at once; the reason
// types out character by character with a blinking caret until it is done.
export default function CoachSpeech({ verdict, userGuess }: Props) {
  const gotItRight =
    (userGuess === "good" && verdict.isGood) ||
    (userGuess === "bad" && !verdict.isGood);

  const [shownChars, setShownChars] = useState(0);

  useEffect(() => {
    setShownChars(0);
    const interval = setInterval(() => {
      setShownChars((prev) => {
        if (prev >= verdict.reason.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(interval);
  }, [verdict.reason]);

  const typingText = verdict.reason.slice(0, shownChars);
  const typing = shownChars < verdict.reason.length;

  return (
    <div className="coach-speech">
      <img src={WILLIAM_SRC} className="coach-avatar" alt="William" width={44} height={44} />
      <div className="coach-bubble">
        <div className="coach-verdict-mark">{gotItRight ? "✓ Nailed it." : "✗ Almost."}</div>
        <div className="coach-headline">{verdict.headline}</div>
        <div className={"coach-reason" + (typing ? " coach-typing" : "")}>{typingText}</div>
      </div>
    </div>
  );
}
