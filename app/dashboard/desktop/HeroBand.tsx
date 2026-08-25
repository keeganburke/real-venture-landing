"use client";

import HeroTile from "./HeroTile";
import { SPRINT_STEPS } from "../hub-copy";

export default function HeroBand() {
  return (
    <div className="hub-d-hero">
      <div className="hub-d-hero-inner">
        <div className="hub-d-hero-greet">
          <span className="hub-d-pulse" /> Hey Keegan {"·"} 23 live now
        </div>
        <h1 className="hub-d-hero-h">
          Where do you
          <br />
          want to go?
        </h1>
        <p className="hub-d-hero-sub">
          {"Three ways forward today. Pick one."}
        </p>

        <div className="hub-d-hero-tiles">
          <HeroTile
            variant="discord"
            badge="Not joined yet"
            title="Join the Discord"
            sub={"Live calls, community chat, deal reviews. One click and you're in."}
            cta="Add me now →"
            href="https://discord.gg/YOUR_INVITE" // TODO real invite
            external
            icon={
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            }
          />
          <HeroTile
            variant="sprint"
            badge="0 / 7"
            title="Your 14-day sprint"
            sub="Start on Day 1. Most members hit contract by Day 14."
            cta="Start Day 1 →"
            href={SPRINT_STEPS[0].href}
            external
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
                <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              </svg>
            }
          />
          <HeroTile
            variant="live"
            badge="Wed 4:30 PM"
            title="Next livestream"
            sub={"With Henry · deal review + Q&A. Recording drops right after."}
            cta="Add to calendar →"
            href="/livestreams"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.93 19.07A10 10 0 013.51 6.36M19.07 4.93a10 10 0 011.42 12.71" />
                <path d="M8.46 15.54A5 5 0 018.46 8.46M15.54 8.46a5 5 0 010 7.08" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}
