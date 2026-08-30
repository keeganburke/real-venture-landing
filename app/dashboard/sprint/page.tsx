import type { Metadata } from "next";
import SprintClient from "./SprintClient";

export const metadata: Metadata = {
  title: "Real Venture | 14-Day Sprint",
};

// Auth is handled upstream by app/dashboard/layout.tsx (no session -> Whop
// start, no completed intake -> /onboarding), so there is nothing to gate
// here. Same shape as dashboard/discord-help/page.tsx.
export default function SprintPage() {
  return <SprintClient />;
}
