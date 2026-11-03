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
  external?: boolean;
};

export const DESTINATIONS: Destination[] = [
  {
    id: "courses",
    emoji: "📚",
    title: "Course library",
    sub: "All 13 lessons, start to finish",
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
    emoji: "💰",
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
    href: "https://docs.google.com/forms/d/1_6w6JI5derd9pxEm4G2850pTWtfu0wwiCM-i6XA3pgA/viewform",
    external: true,
  },
  {
    id: "suggest",
    emoji: "💡",
    label: "Suggest a feature",
    href: "https://docs.google.com/forms/d/1_6w6JI5derd9pxEm4G2850pTWtfu0wwiCM-i6XA3pgA/viewform",
    external: true,
  },
];

// Real recurring call schedule. Same times every week, two calls every day.
// THE single source: the hub homepage reads the next few off it, the
// livestreams page renders all of them. Update this array when the schedule
// changes and both follow.
//
// startTime and endTime are Pacific wall-clock. Both readers convert to the
// viewer's zone, so nothing here is ever a UTC offset.
export type WeeklyCall = {
  id: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  startTime: string;  // "4:00 PM"
  endTime: string;    // "5:00 PM"
  host: string;
  type: string;       // Descriptive session name, e.g. "Live deal underwriting"
  // One line on what to bring or what to expect. Rendered under the time on
  // the livestreams page; the hub shows title, host and time only.
  detail?: string;
};

const UNDERWRITING = "Bring a property you're looking at.";
const EVENING_QA = "Ask anything, no question too basic.";
const LEAD_GEN = "How to find deals on Zillow and other free sites.";
const THREE_COACHES = "Three coaches, bring anything.";

export const WEEKLY_SCHEDULE: WeeklyCall[] = [
  { id: "mon-1", day: "Mon", startTime: "4:30 PM", endTime: "5:30 PM", host: "Stewart D.", type: "Live deal underwriting", detail: UNDERWRITING },
  { id: "mon-2", day: "Mon", startTime: "7:00 PM", endTime: "8:00 PM", host: "Aldo V", type: "Evening Q&A", detail: EVENING_QA },

  { id: "tue-1", day: "Tue", startTime: "11:00 AM", endTime: "1:00 PM", host: "Cluelessmarco", type: "Lead gen work session", detail: LEAD_GEN },
  { id: "tue-2", day: "Tue", startTime: "4:00 PM", endTime: "5:00 PM", host: "BGrizz, Mello, OnTheComeUpAdy", type: "Deal analysis and open Q&A", detail: THREE_COACHES },

  { id: "wed-1", day: "Wed", startTime: "4:00 PM", endTime: "5:00 PM", host: "William Henry Lynch IV", type: "Founder call with William", detail: "Bring your deals and the big questions, where to focus, what to do next." },
  { id: "wed-2", day: "Wed", startTime: "7:00 PM", endTime: "8:00 PM", host: "Aldo V", type: "Evening Q&A", detail: EVENING_QA },

  { id: "thu-1", day: "Thu", startTime: "11:00 AM", endTime: "1:00 PM", host: "Cluelessmarco", type: "Lead gen work session", detail: LEAD_GEN },
  { id: "thu-2", day: "Thu", startTime: "4:00 PM", endTime: "5:00 PM", host: "BGrizz, Mello, OnTheComeUpAdy", type: "Deal analysis and open Q&A", detail: THREE_COACHES },

  { id: "fri-1", day: "Fri", startTime: "11:00 AM", endTime: "1:00 PM", host: "Stewart D.", type: "Live deal underwriting", detail: UNDERWRITING },
  { id: "fri-2", day: "Fri", startTime: "4:00 PM", endTime: "5:00 PM", host: "Keegan Burke", type: "Founder call", detail: "Underwriting and deal updates from the guy running our pipeline." },

  { id: "sat-1", day: "Sat", startTime: "11:00 AM", endTime: "1:00 PM", host: "Cluelessmarco and OnTheComeUpAdy", type: "Lead gen work session", detail: LEAD_GEN },
  { id: "sat-2", day: "Sat", startTime: "4:00 PM", endTime: "6:00 PM", host: "Aldo V", type: "Two hour open Q&A and work session", detail: EVENING_QA },

  { id: "sun-1", day: "Sun", startTime: "3:00 PM", endTime: "4:00 PM", host: "BGrizz, Mello, OnTheComeUpAdy", type: "Deal analysis and open Q&A", detail: THREE_COACHES },
  { id: "sun-2", day: "Sun", startTime: "6:00 PM", endTime: "7:00 PM", host: "Stewart D.", type: "Live deal underwriting", detail: UNDERWRITING },
];
