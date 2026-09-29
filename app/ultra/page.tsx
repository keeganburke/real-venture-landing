import LandingClient from "../LandingClient";

// ULTRA monthly variant: same page as the homepage but Base and Pro are hidden,
// pinned to the monthly plan with no term toggle, so the only checkout is $249 / month (plan_mjpuBNS3KJqmw)
export default function UltraPage() {
  return <LandingClient variant="ultra" />;
}
