import CancelShell from "../_components/CancelShell";
import FinalLoss from "../_components/FinalLoss";

export default function CancelFinalPage() {
  return (
    <CancelShell eyebrow="BEFORE YOU GO" heading="Here's what you're losing." requireReason={true}>
      <FinalLoss />
    </CancelShell>
  );
}
