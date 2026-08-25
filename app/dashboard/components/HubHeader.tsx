"use client";

import { STATS } from "../hub-copy";

type Props = {
  onLogWin: () => void;
  onTour: () => void;
};

export default function HubHeader({ onLogWin, onTour }: Props) {
  return (
    <>
      <header className="app-hdr">
        <div className="logo">
          <div className="logo-mark">R</div>
          <div className="logo-txt">
            REAL <span>VENTURE</span>
          </div>
        </div>
        <div className="hdr-actions">
          <button className="hdr-btn" title="Log a Win" onClick={onLogWin}>
            {"\u{1F3C6}"}
          </button>
          <button className="hdr-btn" title="Take the Tour" onClick={onTour}>
            {"✨"}
          </button>
          <div className="avatar-hdr">K</div>
        </div>
      </header>
      <div className="stat-row">
        <div className="stat streak">
          {"\u{1F525}"} <span className="stat-num">{STATS.streak}</span> day
        </div>
        <div className="stat">
          {"\u{1F393}"} <span className="stat-num">{STATS.lessons}</span> lessons
        </div>
        <div className="stat">
          {"\u{1F3C6}"} <span className="stat-num">{STATS.wins}</span> wins
        </div>
        <div className="stat">
          {"\u{1F48E}"} {STATS.tier}
        </div>
      </div>
    </>
  );
}
