"use client";

import { STATS } from "../hub-copy";

export default function NavBar() {
  return (
    <div className="hub-d-nav">
      <div className="hub-d-nav-l">
        <div className="hub-d-logo">
          <div className="hub-d-logo-mark">R</div>
          <div className="hub-d-logo-txt">
            REAL <span>VENTURE</span>
          </div>
        </div>
        <div className="hub-d-nav-links">
          <a href="#" className="hub-d-on">Hub</a>
          <a href="#">Learn</a>
          <a href="#">Tools</a>
          <a href="#">Community</a>
          <a href="#">Wins</a>
        </div>
      </div>
      <div className="hub-d-nav-r">
        <div className="hub-d-stat-pill hub-d-streak">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
          </svg>
          <span className="hub-d-n">{STATS.streak}</span> day
        </div>
        <div className="hub-d-stat-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
          <span className="hub-d-n">{STATS.lessons}</span> lessons
        </div>
        <div className="hub-d-stat-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z" />
          </svg>
          <span className="hub-d-n">{STATS.wins}</span> wins
        </div>
        <button className="hub-d-nav-btn" aria-label="Favorites">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15 9l7 .5-5.5 5 2 7.5L12 18l-6.5 4 2-7.5L2 9.5 9 9z" />
          </svg>
        </button>
        <button className="hub-d-nav-btn" aria-label="Alerts">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </button>
        <div className="hub-d-avatar">K</div>
      </div>
    </div>
  );
}
