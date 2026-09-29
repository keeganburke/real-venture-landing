import LandingClient from "../LandingClient";

// ULTRA 3-month variant: same page as the homepage but Base and Pro are hidden,
// pinned to the 3-month plan with no term toggle, so the only checkout is $600 / 3 months (plan_MVEXluUMjBlxL)
export default function Ultra3Page() {
  return <LandingClient variant="ultra3" />;
}
