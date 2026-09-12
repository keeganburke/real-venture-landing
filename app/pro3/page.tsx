import LandingClient from "../LandingClient";

// PRO 3-month variant: same Pro-only page as /pro (Base and Ultra hidden), but
// pinned to the 3-month plan with no term toggle, so the only checkout is
// $130 / 3 months (plan_9nyRNbuhQF0pk).
export default function Pro3Page() {
  return <LandingClient variant="pro3" />;
}
