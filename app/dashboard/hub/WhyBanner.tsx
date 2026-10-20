// The member's own answer to intake Q1 ("What would your first $5,000
// change for you?"), read back from member_profiles.intake_dream. Hidden
// for members with no answer (legacy members bypassed onboarding).
export default function WhyBanner({ why }: { why: string | null }) {
  if (!why) return null;
  return (
    <div className="why-banner">
      <span className="why-label">YOUR WHY:</span>
      <span className="why-text">{why}</span>
    </div>
  );
}
