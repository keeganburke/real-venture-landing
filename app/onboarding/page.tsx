import { redirect } from "next/navigation";
import { getIntakeCookie } from "../../lib/intake-cookie";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const { force } = await searchParams;
  const answers = await getIntakeCookie();
  const forced = force === "1";
  if (answers?.completedAt && !forced) redirect("/dashboard");
  // answers.tourCompletedAt rides in the same signed payload; OnboardingClient
  // reads it to skip the tour phase on revisit. A forced replay (Take the
  // Tour) strips it from the props so the tour renders again; the cookie
  // itself is untouched and prior answers stay prefilled.
  const initialAnswers = forced ? { ...(answers ?? {}), tourCompletedAt: null } : (answers ?? {});
  return <OnboardingClient initialAnswers={initialAnswers} />;
}
