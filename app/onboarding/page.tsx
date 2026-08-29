import { redirect } from "next/navigation";
import { getIntakeCookie } from "../../lib/intake-cookie";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const answers = await getIntakeCookie();
  if (answers?.completedAt) redirect("/dashboard");
  // answers.tourCompletedAt rides in the same signed payload; OnboardingClient
  // reads it to skip the tour phase on revisit.
  return <OnboardingClient initialAnswers={answers ?? {}} />;
}
