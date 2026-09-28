import type { IntakeAnswers } from "../../lib/intake-cookie";

// Every answer key the questions can write. Excludes the two bookkeeping
// timestamps, which are set by the save route, never by a question.
export type IntakeField = Exclude<keyof IntakeAnswers, "completedAt" | "tourCompletedAt">;

export type QuestionKind = "text" | "single" | "multi" | "scaleTen" | "number" | "phone";

export type IntakeOption = { value: string; label: string; icon?: string };

// One question renders a follow-up on the SAME screen as its parent:
// tried -> tried_failure. So there are 7 screens but eight answer fields.
export type IntakeQuestion =
  | {
      kind: "text";
      id: "dream" | "tried_failure";
      question: string;
      placeholder: string;
      minChars: number;
      required: boolean;
    }
  | {
      kind: "single";
      id: "commitment_min" | "situation";
      question: string;
      subheading?: string;
      options: IntakeOption[];
    }
  | {
      kind: "multi";
      id: "tried";
      question: string;
      subheading?: string;
      options: IntakeOption[];
      minSelections: number;
      textFollowup?: { id: "tried_failure"; prompt: string; placeholder: string };
    }
  | {
      // 1-10 tap scale, two rows of five. The client renders a branch
      // follow-up text field under the grid (seriousness_followup).
      kind: "scaleTen";
      id: "seriousness_scale";
      question: string;
      min: number;
      max: number;
      anchorLow: string;
      anchorHigh: string;
    }
  | {
      // Integer input (age). Digits only; any non-empty value is accepted.
      kind: "number";
      id: "age";
      question: string;
      subheading?: string;
      placeholder: string;
    }
  | {
      // Optional single-line tel input; Next is always allowed (skip = null).
      kind: "phone";
      id: "phone";
      question: string;
      subheading: string;
      placeholder: string;
    };

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    kind: "text",
    id: "dream",
    question: "What would the first $5,000 change for you?",
    placeholder: "Like - pay off my car, quit my job, move out, help my mom...",
    minChars: 1,
    required: true,
  },
  {
    kind: "single",
    id: "commitment_min",
    question: "How much time can you commit each day?",
    subheading: "This helps us match you with people who have similar time to put in.",
    options: [
      { value: "15", label: "15 minutes" },
      { value: "30", label: "30 minutes" },
      { value: "60", label: "1 hour" },
      { value: "120", label: "2+ hours" },
    ],
  },
  {
    kind: "multi",
    id: "tried",
    question: "What have you tried before to make money online?",
    subheading: "This helps us see your experience with making money online.",
    minSelections: 1,
    options: [
      { value: "drop_shipping", label: "Dropshipping" },
      { value: "trading", label: "Trading stocks or crypto" },
      { value: "reselling", label: "Reselling stuff online" },
      { value: "freelance", label: "Freelance work" },
      { value: "content", label: "Content or social media" },
      { value: "nothing", label: "Nothing yet" },
      { value: "other", label: "Other" },
    ],
    textFollowup: {
      id: "tried_failure",
      prompt: "Then what happened?",
      placeholder: "Like - I lost money, it took too long, I gave up...",
    },
  },
  {
    kind: "single",
    id: "situation",
    question: "What's your situation right now?",
    options: [
      { value: "full_time", label: "Working full time" },
      { value: "part_time", label: "Working part time" },
      { value: "not_working", label: "Not working" },
      { value: "in_school", label: "In school" },
    ],
  },
  {
    kind: "scaleTen",
    id: "seriousness_scale",
    question: "How serious are you about making this work?",
    min: 1,
    max: 10,
    anchorLow: "Just browsing around",
    anchorHigh: "I saw everyone else succeed. I'm going to make this happen, no matter what.",
  },
  {
    kind: "number",
    id: "age",
    question: "How old are you?",
    subheading: "So we can match you with people who just joined, just like you.",
    placeholder: "Your age",
  },
  {
    kind: "phone",
    id: "phone",
    question: "What's your phone number?",
    subheading: "So we can text you about live calls, deals, and keeping your streak alive. Reply STOP to opt out.",
    placeholder: "(555) 555-5555",
  },
];
