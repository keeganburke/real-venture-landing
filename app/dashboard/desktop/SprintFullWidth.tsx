"use client";

import { SPRINT, SPRINT_STEPS } from "../hub-copy";

// Desktop-only sub copy, verbatim from hub-v2-desktop.html.
const SPRINT_SUB_DESKTOP = "Follow in order, most members hit contract by Day 14.";

export default function SprintFullWidth() {
  return (
    <div className="hub-d-sprint">
      <div className="hub-d-sprint-top">
        <div className="hub-d-sprint-t-l">
          <div className="hub-d-sprint-t-icn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
              <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            </svg>
          </div>
          <div>
            <div className="hub-d-sprint-t-h">
              {SPRINT.title} <span className="hub-d-sprint-count">{SPRINT.count}</span>
            </div>
            <div className="hub-d-sprint-t-sub">{SPRINT_SUB_DESKTOP}</div>
          </div>
        </div>
        <div className="hub-d-sprint-progress">
          <div className="hub-d-bar">
            <span />
          </div>
          <span>0%</span>
        </div>
      </div>

      <div className="hub-d-sprint-grid">
        {SPRINT_STEPS.map((step) => (
          <div className="hub-d-sstep" key={step.day}>
            <div>
              <span className="hub-d-sstep-day">{step.day}</span>
              <div className="hub-d-sstep-title">{step.title}</div>
              <div className="hub-d-sstep-desc">{step.desc}</div>
            </div>
            <a className="hub-d-sstep-btn" href={step.href}>
              {step.cta} {"→"}
            </a>
          </div>
        ))}
        <div className="hub-d-sstep hub-d-sstep-bonus">
          <div>
            <span className="hub-d-sstep-day">BONUS</span>
            <div className="hub-d-sstep-title">Refer a friend</div>
            <div className="hub-d-sstep-desc">You both get a month on us.</div>
          </div>
          {/* TODO: referral flow not launched yet */}
          <a
            className="hub-d-sstep-btn"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              console.log("TODO: not launched yet");
            }}
          >
            Share {"→"}
          </a>
        </div>
      </div>
    </div>
  );
}
