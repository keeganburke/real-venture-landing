// /dashboard/path-preview — preview of the Duolingo-style vertical path.
//
// Static UI only. ?step=1..7 marks the current step; ?step=8 means "all
// seven complete" and the trophy at the end of the trail turns live.
//
// Gating: admins-only in production. In dev (NODE_ENV !== "production") the
// admin check is skipped so Keegan can screenshot from localhost without
// changing the allowlist. The /dashboard LAYOUT gate (session + intake) still
// runs ahead of this page — that layout is untouched, so a logged-in dev
// member reaches the page immediately.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { isAdmin } from "../../../lib/admin-allowlist";
import PathHeader from "@/components/path/PathHeader";
import PathTrail from "@/components/path/PathTrail";
import { TOTAL_STEPS } from "@/lib/path/steps";

export const dynamic = "force-dynamic";

/** Clamp ?step= into [1, TOTAL_STEPS + 1]. +1 (=8) means "all done". */
function parseStep(raw: string | string[] | undefined): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const n = str ? parseInt(str, 10) : 1;
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), TOTAL_STEPS + 1);
}

type SearchParams = Promise<{ step?: string }>;

export default async function PathPreviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Admin gate — production only. The dashboard layout above has already
  // required a valid session for everyone.
  if (process.env.NODE_ENV === "production") {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session?.whopUserId) redirect("/api/auth/whop/start");
    if (!isAdmin(session.whopUserId)) redirect("/dashboard");
  }

  const { step } = await searchParams;
  const currentStep = parseStep(step);

  return (
    <main
      style={{
        minHeight: "calc(100vh - 56px)",
        padding: "8px 16px 64px",
        background:
          "radial-gradient(900px 500px at 50% -10%, rgba(229,181,71,0.08), transparent 70%), var(--bg)",
      }}
    >
      <PathHeader currentStep={currentStep} />
      <PathTrail currentStep={currentStep} />
    </main>
  );
}
