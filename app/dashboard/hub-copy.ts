// All hub display strings and data, verbatim from hub-v1_1.html sections 2a/2b
// except: greeting placeholder until Whop profile lands, online count per spec,
// and em dashes rendered dash-free per the standing rule.

export const GREETING = {
  hi: "Hey there \u{1F44B}",
  q: "Where do you want to go?",
  sub: "Pick one.",
};

export const STATS = {
  streak: 1,
  lessons: 0,
  wins: 0,
  tier: "Pro",
};

export const DISCORD = {
  heading: "You're not in the Discord yet",
  bodyLead: "Live calls and community happen there. One click and we add you. ",
  bodyLink: "Make a free Discord",
  bodyTail: " first if you don't have one.",
  linkHref: "https://discord.com/register",
  button: "Add me to the Discord →",
};

export const SPRINT = {
  title: "Your 14-day First Deal Sprint",
  count: "0 / 7",
  subCollapsed: "tap to see your steps →",
  subExpanded: "Follow in order, most members hit contract by Day 14.",
};

export const NEXT_LIVE = {
  time: "Wed 4:30 PM ET",
  host: "with William",
  button: "Schedule",
};

export const SPRINT_STEPS: {
  day: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
}[] = [
  {
    day: "DAY 1",
    title: "Watch: Wholesaling in 20 min",
    desc: "The fast overview so the rest clicks. One lesson.",
    cta: "Start",
    href: "https://realventurestudio.com/learn",
  },
  {
    day: "DAY 2",
    title: "Run your first deal through the analyzer",
    desc: "Any address. See if it's a deal in under a minute.",
    cta: "Open",
    href: "https://realventurestudio.com",
  },
  {
    day: "DAY 3",
    title: "Introduce yourself in the community",
    desc: "Post your market + goal. People who post close faster.",
    cta: "Say hi",
    href: "https://discord.gg/YOUR_INVITE", // TODO real invite
  },
  {
    day: "DAY 5",
    title: "Pull your first lead list",
    desc: "10 motivated sellers in your market.",
    cta: "Find",
    href: "https://realventurestudio.com",
  },
  {
    day: "DAY 7",
    title: "Send your first 10 offers",
    desc: "Contract generator + proof of funds ready.",
    cta: "Make",
    href: "https://realventurestudio.com",
  },
  {
    day: "DAY 10",
    title: "Join a live coaching session",
    desc: "Bring a deal or question. This is where it clicks.",
    cta: "Schedule",
    href: "/livestreams",
  },
  {
    day: "DAY 14",
    title: "Log your first win",
    desc: "Contract or buyer? Log it, watch what happens next.",
    cta: "Log",
    href: "#", // TODO Log a Win modal
  },
];

// Icons: monochrome outline path data (lucide.dev), rendered inside a
// 24x24 stroke="currentColor" svg, same style as the intake icons.
export const TILES: {
  id: string;
  title: string;
  sub: string;
  accent: "purple" | "red" | "blue" | "gold" | "green";
  href: string;
  external: boolean;
  icon: string;
}[] = [
  {
    id: "community",
    title: "Community Chat",
    sub: "23 online · tap to chat",
    accent: "purple",
    href: "https://discord.gg/YOUR_INVITE", // TODO real invite
    external: true,
    icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  },
  {
    id: "livestreams",
    title: "Livestreams",
    sub: "Live calls & replays · Mon Wed Fri 4pm PT",
    accent: "red",
    href: "/livestreams",
    external: false,
    icon: '<circle cx="12" cy="12" r="2"/><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1"/>',
  },
  {
    id: "education",
    title: "Education",
    sub: "13 lessons · start at Lesson 1",
    accent: "blue",
    href: "/dashboard/learn",
    external: false,
    icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  },
  {
    id: "tools",
    title: "Tools",
    sub: "Analyzer, comping, buyers, contracts.",
    accent: "gold",
    href: "https://realventurestudio.com",
    external: true,
    icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  },
  {
    id: "sell",
    title: "Sell your deal",
    sub: "Submit for JV, we help you close.",
    accent: "green",
    href: "https://realventurestudio.com/jv",
    external: true,
    icon: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  },
];

export const SPRINT_ICON =
  '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.09 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.09-1.62 0-5 0-5"/>';

/* ========================================================================
   HUB v2 (single-column Duolingo-style hub). The exports above stay so the
   old hub components remain compilable until the cleanup pass.
   ======================================================================== */

export type Livestream = {
  id: string;
  title: string;
  host: string;
  dateISO: string; // e.g. "2026-08-28T19:00:00-05:00"
  isFeatured?: boolean; // renders in the big featured card, not the compact list
};

export type Destination = {
  id: string;
  emoji: string;
  title: string;
  sub: string;
  href: string;
  external?: boolean;
};

export type FeedbackAction = {
  id: string;
  emoji: string;
  label: string;
  href: string;
};

// TODO: wire to real schedule. Group calls happen 7 days a week.
// Update these dates weekly or wire to a real source.
export const LIVESTREAMS: Livestream[] = [
  {
    id: "ls-featured",
    title: "Deal Analysis Live",
    host: "with William",
    dateISO: "2026-08-28T19:00:00-05:00",
    isFeatured: true,
  },
  {
    id: "ls-2",
    title: "Buyer Building Workshop",
    host: "with Keegan",
    dateISO: "2026-08-29T18:00:00-05:00",
  },
  {
    id: "ls-3",
    title: "Weekly Q&A",
    host: "with William",
    dateISO: "2026-08-31T14:00:00-05:00",
  },
];

export const DESTINATIONS: Destination[] = [
  {
    id: "courses",
    emoji: "📚",
    title: "Course library",
    sub: "All 13 lessons across 4 courses",
    href: "/dashboard/learn",
  },
  {
    id: "studio",
    emoji: "🛠",
    title: "Real Venture Studio",
    sub: "Deal analyzer, buyers, pipeline",
    href: "https://realventurestudio.com/auth",
    external: true,
  },
  {
    id: "resources",
    emoji: "📎",
    title: "Tools & resources",
    sub: "Contracts, scripts, checklists",
    href: "/dashboard/resources",
  },
];

export const FEEDBACK: FeedbackAction[] = [
  {
    id: "bug",
    emoji: "🐛",
    label: "Report a bug",
    href: "/dashboard/report-bug",
  },
  {
    id: "suggest",
    emoji: "💡",
    label: "Suggest a feature",
    href: "/dashboard/suggest-feature",
  },
];
