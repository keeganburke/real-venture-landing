import LandingClient from "../LandingClient";

// PRO-only variant: phone setters send this after closing someone on the Pro
// tier, so the buyer never sees the cheaper Base option post-close. Identical
// to the homepage except both pricing sites render only the Pro card.
export default function ProPage() {
  return <LandingClient variant="pro" />;
}
