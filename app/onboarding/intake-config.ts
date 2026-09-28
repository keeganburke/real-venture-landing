import type { IntakeAnswers } from "../../lib/intake-cookie";

// Every answer key the questions can write. Excludes the two bookkeeping
// timestamps, which are set by the save route, never by a question.
export type IntakeField = Exclude<keyof IntakeAnswers, "completedAt" | "tourCompletedAt">;

export type QuestionKind = "text" | "single" | "multi";

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
      id: "hours" | "worry" | "identity" | "invest" | "seriousness";
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
    };

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    kind: "text",
    id: "dream",
    question: "What would your first $5,000 change for you?",
    placeholder: "Like — pay off my car, quit my job, move out, help my mom...",
    minChars: 1,
    required: true,
  },
  {
    kind: "single",
    id: "hours",
    question: "How many hours a week can you put into this?",
    subheading: "This helps us build your custom roadmap.",
    options: [
      { value: "under_5", label: "Under 5 hours" },
      { value: "five_ten", label: "5 to 10 hours" },
      { value: "ten_twenty", label: "10 to 20 hours" },
      { value: "twenty_plus", label: "More than 20 hours" },
    ],
  },
  {
    kind: "multi",
    id: "tried",
    question: "What have you tried before to make money?",
    subheading: "Pick any that apply.",
    minSelections: 1,
    options: [
      { value: "dropshipping", label: "Dropshipping" },
      { value: "trading", label: "Trading stocks or crypto" },
      { value: "reselling", label: "Reselling stuff online" },
      { value: "freelance", label: "Freelance work" },
      { value: "content", label: "Content or social media" },
      { value: "nothing_yet", label: "Nothing yet" },
      { value: "other", label: "Other" },
    ],
    textFollowup: {
      id: "tried_failure",
      prompt: "What happened?",
      placeholder: "Like — I lost money, it took too long, I gave up...",
    },
  },
  {
    kind: "single",
    id: "worry",
    question: "What's your biggest worry about starting?",
    options: [
      { value: "time", label: "I don't have enough time" },
      { value: "money", label: "I don't have money to spend on tools" },
      { value: "fail_again", label: "I'm scared I'll fail again" },
      { value: "consistency", label: "I don't know if I can stick with it" },
    ],
  },
  {
    kind: "single",
    id: "identity",
    question: "What's your situation right now?",
    options: [
      { value: "full_time", label: "Working a full-time job" },
      { value: "part_time_gig", label: "Working part-time or side gigs" },
      { value: "not_working", label: "Not working right now" },
      { value: "student", label: "In school" },
    ],
  },
  {
    kind: "single",
    id: "invest",
    question: "If a tool cost $200 and made you money faster, could you swing it?",
    options: [
      { value: "easy", label: "Yes, no problem" },
      { value: "manageable", label: "Yes, once I see it working" },
      { value: "stretch", label: "Not right now" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    kind: "single",
    id: "seriousness",
    question: "How serious are you about making this work?",
    options: [
      { value: "curious", label: "Just checking it out" },
      { value: "interested", label: "Pretty interested" },
      { value: "committed", label: "Committed" },
      { value: "all_in", label: "All in" },
    ],
  },
];
