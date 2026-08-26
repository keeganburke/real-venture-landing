import type { IntakeAnswers } from "../../lib/intake-cookie";

export type IntakeField = Exclude<keyof IntakeAnswers, "completedAt">;

export type IntakeOption = {
  value: string;
  // Inner markup of the option's 24x24 outline icon, verbatim from hub-v1_1.html.
  icon: string;
  label: string;
};

export type IntakeQuestion = {
  id: IntakeField;
  question: string;
  options: IntakeOption[];
};

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "experience",
    question: "Where are you in wholesaling?",
    options: [
      {
        value: "never",
        icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
        label: "Never done a deal",
      },
      {
        value: "1-5",
        icon: '<path d="M3 12l7-9 4 5 7-3-4 16H4z"/>',
        label: "1-5 deals",
      },
      {
        value: "6+",
        icon: '<path d="M6 3h12v6a6 6 0 01-12 0zM4 5H2v2a3 3 0 003 3M20 5h2v2a3 3 0 01-3 3M9 21h6M12 17v4"/>',
        label: "6+ deals",
      },
    ],
  },
  {
    id: "bottleneck",
    question: "What's stopping you right now?",
    options: [
      {
        value: "deals",
        icon: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
        label: "Finding deals",
      },
      {
        value: "buyers",
        icon: '<path d="M8 13l3 3 3-3M11 3l-4 4 4 4M17 8V4h-4M7 21l4-4-4-4M13 21h4v-4"/>',
        label: "Finding buyers",
      },
      {
        value: "funding",
        icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v.01M18 14v.01"/>',
        label: "Funding / proof of funds",
      },
      {
        value: "contracts",
        icon: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M9 13h6M9 17h4"/>',
        label: "Contracts & closing",
      },
      {
        value: "all",
        icon: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none"/>',
        label: "All of the above",
      },
    ],
  },
  {
    id: "hours",
    question: "Hours / week you can commit?",
    options: [
      {
        value: "<5",
        icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        label: "Less than 5",
      },
      {
        value: "5-15",
        icon: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
        label: "5-15",
      },
      {
        value: "15+",
        icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
        label: "15+",
      },
    ],
  },
  {
    id: "goal",
    question: "90-day income goal?",
    options: [
      {
        value: "10k",
        icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
        label: "First $10k",
      },
      {
        value: "10-30k",
        icon: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
        label: "$10k to $30k",
      },
      {
        value: "30k+",
        icon: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M6 3l4 6h4l4-6M2 9h20M12 21V9"/>',
        label: "$30k+",
      },
    ],
  },
  {
    id: "need",
    question: "What do you need most from us?",
    options: [
      {
        value: "community",
        icon: '<path d="M17 8a5 5 0 00-10 0v3a3 3 0 003 3h4a3 3 0 003-3zM7 21a5 5 0 0110 0"/><circle cx="6" cy="8" r="2"/><circle cx="18" cy="8" r="2"/>',
        label: "Community & live calls",
      },
      {
        value: "tools",
        icon: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4l-6 6a2 2 0 002.8 2.8l6-6a4 4 0 005.4-5.4l-2.4 2.4-1.4-1.4z"/>',
        label: "Tools & calculators",
      },
      {
        value: "access",
        icon: '<path d="M3 18l2-11 5 4 2-7 2 7 5-4 2 11zM3 21h18"/>',
        label: "Direct access to William & Keegan",
      },
    ],
  },
];
