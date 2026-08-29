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

// Real recurring call schedule. Same times every week.
// Update this array when the schedule changes.
export type WeeklyCall = {
  id: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  startTime: string;  // "4:00 PM"
  endTime: string;    // "5:00 PM"
  host: string;
  type?: string;      // Optional label like "Live Q&A" or "Live Grind"
};

export const WEEKLY_SCHEDULE: WeeklyCall[] = [
  { id: "mon-1", day: "Mon", startTime: "4:00 PM", endTime: "5:00 PM", host: "William" },
  { id: "tue-1", day: "Tue", startTime: "11:00 AM", endTime: "1:00 PM", host: "Marco" },
  { id: "tue-2", day: "Tue", startTime: "4:00 PM", endTime: "6:00 PM", host: "Brandon, Mello, Ady" },
  { id: "wed-1", day: "Wed", startTime: "4:00 PM", endTime: "5:00 PM", host: "William" },
  { id: "wed-2", day: "Wed", startTime: "7:00 PM", endTime: "8:00 PM", host: "Dylan" },
  { id: "thu-1", day: "Thu", startTime: "11:00 AM", endTime: "1:00 PM", host: "Marco" },
  { id: "thu-2", day: "Thu", startTime: "4:00 PM", endTime: "6:00 PM", host: "Brandon, Mello, Ady" },
  { id: "fri-1", day: "Fri", startTime: "4:00 PM", endTime: "5:00 PM", host: "William" },
  { id: "sat-1", day: "Sat", startTime: "11:00 AM", endTime: "1:00 PM", host: "Marco, Ady" },
  { id: "sun-1", day: "Sun", startTime: "4:00 PM", endTime: "6:00 PM", host: "Brandon, Mello, Ady" },
  { id: "sun-2", day: "Sun", startTime: "7:00 PM", endTime: "8:00 PM", host: "Dylan" },
];
