import { getIntakeCookie } from "../../lib/intake-cookie";
import HubClient from "./HubClient";

export default async function DashboardPage() {
  const intake = await getIntakeCookie();
  return <HubClient intakeNeed={intake?.need ?? null} />;
}
