import CancelShell from "../_components/CancelShell";
import TestimonialCard from "../_components/TestimonialCard";
import ContinueLink from "../_components/ContinueLink";

// Server component: reads ?reason so the letter is chosen at render time.
// The heading is the same for every reason; the letter carries the nuance.
export default async function CancelTestimonialPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <CancelShell eyebrow="A MESSAGE FROM WILLIAM" heading="Before you go." requireReason={true}>
      <TestimonialCard reason={reason ?? null} />
      <ContinueLink
        primary={{ label: "Continue", to: "/manage-membership/cancel/pause" }}
        secondary={{ label: "I still want to cancel", to: "/manage-membership/cancel/pause" }}
      />
    </CancelShell>
  );
}
