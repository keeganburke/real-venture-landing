// Static config for the Duolingo-style path at /dashboard/path-preview.
//
// Preview-only: every href is "#" until the live hub consumes this file. The
// order here IS the on-screen order; chest/trophy markers sit between numbered
// steps and are rendered inline by PathTrail.
//
// Mascot speech: PathMascot renders ONE line per numbered step; the mascot
// never speaks over a chest or the trophy, so only step rows carry mascotLine.

export type PathIcon =
  | "chat"
  | "calendar"
  | "play"
  | "gamepad"
  | "calculator"
  | "phone"
  | "document";

export type PathItem =
  | {
      kind: "step";
      id: string;
      num: number;
      title: string;
      description: string;
      icon: PathIcon;
      href: string;
      mascotLine: string;
    }
  | { kind: "chest"; id: string }
  | { kind: "trophy"; id: string; title: string };

/**
 * Trail order. Numbered steps count 1..7; chests sit between step 3→4 and
 * step 5→6; the trophy sits at the end after step 7. Keep this a single flat
 * array so PathTrail can walk it once and emit nodes in order.
 */
export const PATH_ITEMS: PathItem[] = [
  {
    kind: "step",
    id: "join-discord",
    num: 1,
    title: "Join the Discord",
    description: "Get in the room where every student lives.",
    icon: "chat",
    href: "#",
    mascotLine: "First move: get in the Discord.",
  },
  {
    kind: "step",
    id: "book-live-call",
    num: 2,
    title: "Book your first live call",
    description: "Pick a time to get on with the team.",
    icon: "calendar",
    href: "#",
    mascotLine: "Book a call. Live reps beat lurking every time.",
  },
  {
    kind: "step",
    id: "orientation",
    num: 3,
    title: "Orientation",
    description: "The 20-minute rundown of how everything works.",
    icon: "play",
    href: "#",
    mascotLine: "Orientation first. The map before the hike.",
  },
  { kind: "chest", id: "chest-1" },
  {
    kind: "step",
    id: "comp-game",
    num: 4,
    title: "Play the Comp Game",
    description: "Learn to comp a deal by playing, not reading.",
    icon: "gamepad",
    href: "#",
    mascotLine: "Comp Game time. Learn by doing.",
  },
  {
    kind: "step",
    id: "analyze-first-deal",
    num: 5,
    title: "Analyze your first deal",
    description: "Run a real property through the analyzer.",
    icon: "calculator",
    href: "#",
    mascotLine: "Analyze one. Just one. We fix it together after.",
  },
  { kind: "chest", id: "chest-2" },
  {
    kind: "step",
    id: "send-ten-offers",
    num: 6,
    title: "Send your first 10 offers",
    description: "Ten is the magic number. Volume beats perfection.",
    icon: "phone",
    href: "#",
    mascotLine: "Ten offers. Short calls, fast nos, keep moving.",
  },
  {
    kind: "step",
    id: "get-signed",
    num: 7,
    title: "Get it signed",
    description: "Lock a signed contract with a seller.",
    icon: "document",
    href: "#",
    mascotLine: "Signature on paper. This is the one.",
  },
  { kind: "trophy", id: "trophy-first-deal", title: "First Deal" },
];

/** Count of numbered steps (not items). Header reads this. */
export const TOTAL_STEPS = PATH_ITEMS.filter((it) => it.kind === "step").length;
