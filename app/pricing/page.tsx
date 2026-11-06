import { redirect } from "next/navigation";

// /pricing has no page of its own: pricing lives in the modal on the landing
// page, and /?pricing=1 opens it (app/LandingClient.tsx). The Discord kick DM
// (KICK_DM in lib/discord-kick.ts) links here, so this must never 404.
export default function PricingPage() {
  redirect("/?pricing=1");
}
