// Student payouts shown in the landing-page marquee (app/components/PayoutCarousel.tsx).
// Single source of truth: edit this file to add, reorder, or update a payout.
// Screenshots live in public/wins/, avatars in public/payouts/avatars/.
// name and amount below are the real values previously encoded in the
// screenshot filenames; age, avatar, and blurb are placeholders until real
// data is supplied.

export type Payout = {
  id: string;
  screenshot: string;     // path under /public (existing screenshot in /wins/)
  screenshotAlt: string;  // for accessibility
  avatar: string;         // path under /public/payouts/avatars/
  name: string;
  age: number;
  amount: string;         // display string like "$3,000"
  blurb: string;
};

export const PAYOUTS: Payout[] = [
  {
    id: "rosely-10000",
    screenshot: "/wins/01-rosely-10000.png",
    screenshotAlt: "Rosely - $10,000 payout",
    avatar: "/avatars/Rosely.jpeg",
    name: "Rosely",
    age: 21,
    amount: "$10,000",
    blurb: "Full-time college, full-time Chick-fil-A. Closed both deals in her free time, just a few hours a week.",
  },
  {
    id: "dylan-6000",
    screenshot: "/wins/02-dylan-6000.png",
    screenshotAlt: "Dylan - $6,000 payout",
    avatar: "/avatars/dylan.jpg",
    name: "Dylan",
    age: 20,
    amount: "$6,000",
    blurb: "Full-time student in a fraternity with a part-time job. Kept closing deals without giving up.",
  },
  {
    id: "yves-5000",
    screenshot: "/wins/03-yves-5000.png",
    screenshotAlt: "Yves - $5,000 payout",
    avatar: "/avatars/yves.jpg",
    name: "Yves",
    age: 21,
    amount: "$5,000",
    blurb: "70 hours a week between two fast food jobs. Still made this a side hustle and closed every one.",
  },
  {
    id: "rosely-7500",
    screenshot: "/wins/04-rosely-7500.png",
    screenshotAlt: "Rosely - $7,500 payout",
    avatar: "/avatars/Rosely.jpeg",
    name: "Rosely",
    age: 21,
    amount: "$7,500",
    blurb: "Full-time college, full-time Chick-fil-A. Closed both deals in her free time, just a few hours a week.",
  },
  {
    id: "zach-4000",
    screenshot: "/wins/05-zach-4000.png",
    screenshotAlt: "Zach - $4,000 payout",
    avatar: "/avatars/zach.jpg",
    name: "Zach",
    age: 23,
    amount: "$4,000",
    blurb: "Doorman when he closed $6K in 45 days. Used the money to move out of his parents' house.",
  },
  {
    id: "dylan-6000-b",
    screenshot: "/wins/06-dylan-6000-b.png",
    screenshotAlt: "Dylan - $6,000 payout",
    avatar: "/avatars/dylan.jpg",
    name: "Dylan",
    age: 20,
    amount: "$6,000",
    blurb: "Full-time student in a fraternity with a part-time job. Kept closing deals without giving up.",
  },
  {
    id: "yves-3000",
    screenshot: "/wins/07-yves-3000.png",
    screenshotAlt: "Yves - $3,000 payout",
    avatar: "/avatars/yves.jpg",
    name: "Yves",
    age: 21,
    amount: "$3,000",
    blurb: "70 hours a week between two fast food jobs. Still made this a side hustle and closed every one.",
  },
  {
    id: "melissa-4000",
    screenshot: "/wins/08-melissa-4000.png",
    screenshotAlt: "Melissa - $4,000 payout",
    avatar: "/avatars/melissa.jpg",
    name: "Melissa",
    age: 20,
    amount: "$4,000",
    blurb: "College student with a part-time job. First deal was $4K, closed in her free time.",
  },
  {
    id: "dylan-5000",
    screenshot: "/wins/09-dylan-5000.png",
    screenshotAlt: "Dylan - $5,000 payout",
    avatar: "/avatars/dylan.jpg",
    name: "Dylan",
    age: 20,
    amount: "$5,000",
    blurb: "Full-time student in a fraternity with a part-time job. Kept closing deals without giving up.",
  },
  {
    id: "mello-3000",
    screenshot: "/wins/10-mello-3000.png",
    screenshotAlt: "Mello - $3,000 payout",
    avatar: "/avatars/mello.jpg",
    name: "Mello",
    age: 17,
    amount: "$3,000",
    blurb: "Joined for $50, couldn't afford the next month, left. Took what he learned, closed a $3K deal on his own, then came back to share it.",
  },
  {
    id: "alex-3000",
    screenshot: "/wins/11-alex-3000.png",
    screenshotAlt: "Alex - $3,000 payout",
    avatar: "/avatars/alex.jpg",
    name: "Alex",
    age: 19,
    amount: "$3,000",
    blurb: "Full-time college doing sales and wholesaling at the same time. Still closed $3K.",
  },
  {
    id: "dylan-3000",
    screenshot: "/wins/12-dylan-3000.png",
    screenshotAlt: "Dylan - $3,000 payout",
    avatar: "/avatars/dylan.jpg",
    name: "Dylan",
    age: 20,
    amount: "$3,000",
    blurb: "Full-time student in a fraternity with a part-time job. Kept closing deals without giving up.",
  },
  {
    id: "faith-2500",
    screenshot: "/wins/13-faith-2500.png",
    screenshotAlt: "Faith - $2,500 payout",
    avatar: "/avatars/faith.jpg",
    name: "Faith",
    age: 21,
    amount: "$2,500",
    blurb: "Full-time college and full-time job. Wholesaling was her way in to investing.",
  },
  {
    id: "wittman-3000",
    screenshot: "/wins/14-wittman-3000.png",
    screenshotAlt: "Wittman - $3,000 payout",
    avatar: "/avatars/wittman.jpg",
    name: "Wittman",
    age: 19,
    amount: "$3,000",
    blurb: "Full-time college. Had a bunch of deals fall through and didn't quit. Eventually broke through.",
  },
  {
    id: "zach-2000",
    screenshot: "/wins/15-zach-2000.png",
    screenshotAlt: "Zach - $2,000 payout",
    avatar: "/avatars/zach.jpg",
    name: "Zach",
    age: 23,
    amount: "$2,000",
    blurb: "Doorman when he closed $6K in 45 days. Used the money to move out of his parents' house.",
  },
];
