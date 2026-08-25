import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";

export const metadata: Metadata = {
  title: "Welcome to Real Venture",
};

// Gating happens here at layout level, not in middleware (spec 6.1). This
// layout only READS the session cookie; all cookie writes stay in route
// handlers because server components cannot persist them (spec 6.12).
export default async function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) redirect("/api/auth/whop/start");

  return children;
}
