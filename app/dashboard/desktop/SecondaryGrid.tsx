"use client";

import type { MouseEvent, ReactNode } from "react";

// Desktop-only tile set, copy verbatim from hub-v2-desktop.html. Boards and
// Founder Zone are new for desktop and deliberately NOT in hub-copy.ts TILES.
type DesktopTile = {
  id: string;
  variant: string;
  title: string;
  sub: string;
  meta: ReactNode;
  href: string;
  external: boolean;
  launched: boolean;
  crown?: string;
  icon: ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DESKTOP_TILES: DesktopTile[] = [
  {
    id: "community",
    variant: "community",
    title: "Community Chat",
    sub: "Ask questions, share wins, hang out.",
    meta: (
      <>
        <span className="hub-d-dot" />
        23 online now
      </>
    ),
    href: "https://discord.gg/YOUR_INVITE", // TODO real invite
    external: true,
    launched: true,
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    id: "education",
    variant: "education",
    title: "Education",
    sub: "Every course, breakdown, and quiz.",
    meta: "13 lessons · start at Lesson 1",
    href: "https://realventurestudio.com/learn",
    external: true,
    launched: true,
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
  },
  {
    id: "tools",
    variant: "tools",
    title: "Tools",
    sub: "Analyzer, comping, buyers, contracts.",
    meta: "Opens the Studio ↗",
    href: "https://realventurestudio.com",
    external: true,
    launched: true,
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M14.7 6.3a4 4 0 00-5.4 5.4l-6 6a2 2 0 002.8 2.8l6-6a4 4 0 005.4-5.4l-2.4 2.4-1.4-1.4z" />
      </svg>
    ),
  },
  {
    id: "sell",
    variant: "sell",
    title: "Sell your deal",
    sub: "Submit for JV, we help you close.",
    meta: "60 / 40 split · 3-day review",
    href: "https://realventurestudio.com/jv",
    external: true,
    launched: true,
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M15 9.5C15 8 13.5 7 12 7s-3 1-3 2.5c0 3 6 1.5 6 4.5 0 1.5-1.5 2.5-3 2.5s-3-1-3-2.5" />
      </svg>
    ),
  },
  {
    id: "boards",
    variant: "boards",
    title: "Community Boards",
    sub: "Suggestions, bug reports, roadmap.",
    meta: "Coming soon",
    href: "#", // TODO not launched yet
    external: false,
    launched: false,
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    id: "founder",
    variant: "founder",
    title: "Founder Zone",
    sub: "Direct DM with William & Keegan.",
    meta: "25 seats · locked pricing",
    href: "#", // TODO not launched yet
    external: false,
    launched: false,
    crown: "\u{1F451} Ultra",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M2 20l3-10 5 4 2-7 2 7 5-4 3 10zM4 21h16" />
      </svg>
    ),
  },
];

export default function SecondaryGrid() {
  const blockUnlaunched = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    console.log("TODO: not launched yet");
  };

  return (
    <div className="hub-d-tiles">
      {DESKTOP_TILES.map((tile) => (
        <a
          className={`hub-d-tile hub-d-t-${tile.variant}`}
          key={tile.id}
          href={tile.href}
          {...(tile.external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          {...(tile.launched ? {} : { onClick: blockUnlaunched })}
        >
          {tile.crown && <span className="hub-d-founder-crown">{tile.crown}</span>}
          <div className="hub-d-tile-top">
            <div className="hub-d-tile-icn">{tile.icon}</div>
            <div className="hub-d-tile-arw">{"→"}</div>
          </div>
          <div>
            <div className="hub-d-tile-title">{tile.title}</div>
            <div className="hub-d-tile-sub">{tile.sub}</div>
          </div>
          <div className="hub-d-tile-meta">{tile.meta}</div>
        </a>
      ))}
    </div>
  );
}
