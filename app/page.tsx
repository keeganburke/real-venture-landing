import LandingClient from "./LandingClient";

// The landing body lives in LandingClient so / and /free share one source of
// truth; only the hero differs. See app/free/page.tsx.
export default function Home() {
  return <LandingClient variant="default" />;
}
