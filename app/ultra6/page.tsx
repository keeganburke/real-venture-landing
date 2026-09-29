import LandingClient from "../LandingClient";

// ULTRA 6-month variant: same page as the homepage but Base and Pro are hidden,
// pinned to the 6-month plan with no term toggle, so the only checkout is $1,000 / 6 months (plan_8CGnZkflAnXOe)
export default function Ultra6Page() {
  return <LandingClient variant="ultra6" />;
}
