import CancelShell from "../_components/CancelShell";
import PauseOptions from "../_components/PauseOptions";

export default function CancelPausePage() {
  return (
    <CancelShell eyebrow="TAKE A BREAK" heading="Pause instead." requireReason={true}>
      <PauseOptions />
    </CancelShell>
  );
}
