import CancelShell from "../_components/CancelShell";
import ReasonPicker from "../_components/ReasonPicker";

export default function CancelReasonPage() {
  return (
    <CancelShell eyebrow="BEFORE YOU CANCEL" heading="What's the main reason?" requireReason={false}>
      <ReasonPicker />
    </CancelShell>
  );
}
