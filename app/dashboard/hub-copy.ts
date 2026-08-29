// Hub copy: static content for the single-column hub (hub2) and the
// group-calls schedule page.

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
    title: "Tools",
    sub: "Contracts, scripts, checklists",
    href: "/dashboard/tools",
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

// TODO: confirm Live Grind hosts; William Lynch confirmed for Q&A.
// Real recurring call schedule. Same times every week.
// Update this array when the schedule changes.
export type WeeklyCall = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  title: string;
  hosts: string;
  timePST: string;    // "4:00 PM"
  timeEST: string;    // "7:00 PM"
  type: "Q&A" | "Live Grind";
};

export const WEEKLY_SCHEDULE: WeeklyCall[] = [
  { day: "Mon", title: "Live Q&A", hosts: "William Lynch", timePST: "4:00 PM", timeEST: "7:00 PM", type: "Q&A" },
  { day: "Tue", title: "Live Grind", hosts: "Keegan + team", timePST: "4:00 PM", timeEST: "7:00 PM", type: "Live Grind" },
  { day: "Wed", title: "Live Q&A", hosts: "William Lynch", timePST: "4:00 PM", timeEST: "7:00 PM", type: "Q&A" },
  { day: "Thu", title: "Live Grind", hosts: "Keegan + team", timePST: "4:00 PM", timeEST: "7:00 PM", type: "Live Grind" },
  { day: "Fri", title: "Live Q&A", hosts: "William Lynch", timePST: "4:00 PM", timeEST: "7:00 PM", type: "Q&A" },
  { day: "Sun", title: "Live Grind", hosts: "Keegan + team", timePST: "4:00 PM", timeEST: "7:00 PM", type: "Live Grind" },
];
