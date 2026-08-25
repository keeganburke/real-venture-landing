import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";
import { getIntakeCookie } from "../../lib/intake-cookie";

export const metadata: Metadata = {
  title: "Real Venture | Hub",
};

// Same gate pattern as app/onboarding/layout.tsx: reads only, no cookie
// writes in server components. Additionally requires a completed intake.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) redirect("/api/auth/whop/start");

  const intake = await getIntakeCookie();
  if (!intake?.completedAt) redirect("/onboarding");

  return children;
}
