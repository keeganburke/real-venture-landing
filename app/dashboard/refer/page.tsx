import type { Metadata } from "next";
import ReferClient from "./ReferClient";

export const metadata: Metadata = {
  title: "Real Venture | Refer & Earn",
};

// Auth is enforced by app/dashboard/layout.tsx. The client component loads
// everything it needs from /api/referral/me, so this shell stays static.
export default function ReferPage() {
  return <ReferClient />;
}
