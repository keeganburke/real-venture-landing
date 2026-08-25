"use client";

import { SPRINT, SPRINT_ICON, SPRINT_STEPS } from "../hub-copy";

type Props = {
  expanded: boolean;
  onToggle: () => void;
};

export default function SprintCard({ expanded, onToggle }: Props) {
  return (
    <div className="sprint">
      <div
        className="sprint-hdr"
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
      >
        <div className="sprint-icn">
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: SPRINT_ICON }}
          />
        </div>
        <div className="sprint-body">
          <div className="sprint-title">
            {SPRINT.title} <span className="sprint-count">{SPRINT.count}</span>
          </div>
          <div className="sprint-sub">
            {expanded ? SPRINT.subExpanded : SPRINT.subCollapsed}
          </div>
        </div>
        <div className="sprint-chev">{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div className="sprint-steps">
          {SPRINT_STEPS.map((step) => (
            <div className="sstep" key={step.day}>
              <div className="sstep-check" />
              <div className="sstep-body">
                <span className="sstep-day">{step.day}</span>
                <span className="sstep-title">{step.title}</span>
                <div className="sstep-desc">{step.desc}</div>
              </div>
              <a className="sstep-btn" href={step.href}>
                {step.cta}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
