// Hub copy: static content for the single-column hub (hub2) and the
// group-calls schedule page.

/* ========================================================================
   HUB v2 (single-column Duolingo-style hub)
   ======================================================================== */

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
  type: string;       // Descriptive session name, e.g. "Live Coaching"
};

export const WEEKLY_SCHEDULE: WeeklyCall[] = [
  { id: "mon-1", day: "Mon", startTime: "4:00 PM", endTime: "5:00 PM", host: "William", type: "Live Coaching" },
  { id: "tue-1", day: "Tue", startTime: "11:00 AM", endTime: "1:00 PM", host: "Marco", type: "Live Buyer Outreach" },
  { id: "tue-2", day: "Tue", startTime: "4:00 PM", endTime: "6:00 PM", host: "Brandon, Mello, Ady", type: "Live Deal Underwriting" },
  { id: "wed-1", day: "Wed", startTime: "4:00 PM", endTime: "5:00 PM", host: "William", type: "Live Coaching" },
  { id: "wed-2", day: "Wed", startTime: "7:00 PM", endTime: "8:00 PM", host: "Dylan", type: "Live Cold Call Session" },
  { id: "thu-1", day: "Thu", startTime: "11:00 AM", endTime: "1:00 PM", host: "Marco", type: "Live Buyer Outreach" },
  { id: "thu-2", day: "Thu", startTime: "4:00 PM", endTime: "6:00 PM", host: "Brandon, Mello, Ady", type: "Live Deal Underwriting" },
  { id: "fri-1", day: "Fri", startTime: "4:00 PM", endTime: "5:00 PM", host: "William", type: "Live Coaching" },
  { id: "sat-1", day: "Sat", startTime: "11:00 AM", endTime: "1:00 PM", host: "Marco, Ady", type: "Live Deal Breakdown" },
  { id: "sun-1", day: "Sun", startTime: "4:00 PM", endTime: "6:00 PM", host: "Brandon, Mello, Ady", type: "Live Q&A + Deal Review" },
  { id: "sun-2", day: "Sun", startTime: "7:00 PM", endTime: "8:00 PM", host: "Dylan", type: "Live Cold Call Session" },
];
