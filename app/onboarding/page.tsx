import { redirect } from "next/navigation";
import { getIntakeCookie } from "../../lib/intake-cookie";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const answers = await getIntakeCookie();
  if (answers?.completedAt) redirect("/dashboard");
  return <OnboardingClient initialAnswers={answers ?? {}} />;
}
