import CancelShell from "../_components/CancelShell";
import TestimonialCard from "../_components/TestimonialCard";

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
      <TestimonialCard reason={reason ?? null} showActions />
    </CancelShell>
  );
}
