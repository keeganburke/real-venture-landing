import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { isAdmin } from "../../../../lib/admin-allowlist";
import CompPickerClient from "./CompPickerClient";
import "./comp-picker.css";

export const dynamic = "force-dynamic";

// Admin-only skeleton of the comp picker mini-game. Same gate as the other
// admin pages: rv_session cookie, then the Whop id allowlist.
export default async function AdminCompPickerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session?.whopUserId) {
    redirect("/api/auth/whop/start");
  }
  if (!isAdmin(session.whopUserId)) {
    redirect("/dashboard");
  }

  return (
    <div className="admin-page">
      <div className="admin-nav">
        <Link href="/dashboard/admin/onboarding" className="admin-nav-link">Onboarding</Link>
        <Link href="/dashboard/admin/discord" className="admin-nav-link">Discord</Link>
        <Link href="/dashboard/admin/comp-picker" className="admin-nav-link active">Comp picker</Link>
      </div>
      <CompPickerClient />
    </div>
  );
}
