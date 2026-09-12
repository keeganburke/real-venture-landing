import LandingClient from "../LandingClient";

// PRO 6-month variant: same Pro-only page as /pro (Base and Ultra hidden), but
// pinned to the 6-month plan with no term toggle, so the only checkout is
// $250 / 6 months (plan_tfYMBwmuOwuB0).
export default function Pro6Page() {
  return <LandingClient variant="pro6" />;
}
