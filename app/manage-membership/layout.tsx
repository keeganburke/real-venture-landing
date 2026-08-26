import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";

export const metadata: Metadata = {
  title: "Real Venture · Manage Membership",
};

// Same gate pattern as app/onboarding/layout.tsx. Deliberately does NOT
// check intake completion: billing must stay reachable either way.
export default async function ManageMembershipLayout({ children }: LayoutProps<"/manage-membership">) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) redirect("/api/auth/whop/start");

  return children;
}
