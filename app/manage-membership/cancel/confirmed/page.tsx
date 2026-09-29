import { Fragment } from "react";
import Link from "next/link";
import CancelShell from "../_components/CancelShell";

// A paragraph is a list of segments; { hl } segments render gold + bold.
type Seg = string | { hl: string };
type Copy = { eyebrow: string; heading: string; paragraphs: Seg[][] };

// [renewal_date] and [end_date] are literal placeholders until the real
// Whop pause / cancel responses are wired in (Prompt 3c).
function copyFor(action: string | undefined, days: string | undefined): Copy {
  switch (action) {
    case "paused":
      return {
        eyebrow: "PAUSED",
        heading: "You're paused.",
        paragraphs: [
          [
            "Your membership is paused for ",
            { hl: `${days ?? "30"} days` },
            ". You won't be charged during the pause.",
          ],
          [
            "You keep full access until ",
            { hl: "[renewal_date]" },
            " - then access pauses too and automatically resumes when the pause ends.",
          ],
          ["We'll email you before the pause ends so you can prepare."],
        ],
      };
    case "free_days":
      // Dead after the /free-days route was removed; kept until the Prompt 5 cleanup.
      return {
        eyebrow: "15 FREE DAYS ADDED",
        heading: "15 more days on us.",
        paragraphs: [
          ["Your next charge is pushed back by 15 days."],
          [
            "Take the time to actually try the thing. If it's still not for you after 15 days, cancel then - no hard feelings.",
          ],
        ],
      };
    case "cancelled":
      return {
        eyebrow: "CANCELLED",
        heading: "Your membership is cancelled.",
        paragraphs: [
          ["You'll keep access until ", { hl: "[end_date]" }, " and then it won't renew."],
          [
            "If you change your mind before then, just re-subscribe - your account, Discord role, and saved data all come back.",
          ],
          ["Take care."],
        ],
      };
    default:
      return { eyebrow: "DONE", heading: "All set.", paragraphs: [["You're good to go."]] };
  }
}

// Server component: copy follows ?action= (and ?days= for a pause).
export default async function CancelConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; days?: string }>;
}) {
  const { action, days } = await searchParams;
  const copy = copyFor(action, days);
  return (
    <CancelShell eyebrow={copy.eyebrow} heading={copy.heading} requireReason={false}>
      <div className="cancel-sub-block">
        {copy.paragraphs.map((segs, i) => (
          <p key={i}>
            {segs.map((s, j) =>
              typeof s === "string" ? (
                <Fragment key={j}>{s}</Fragment>
              ) : (
                <strong key={j} className="cancel-highlight">
                  {s.hl}
                </strong>
              )
            )}
          </p>
        ))}
      </div>
      <div className="cancel-continue">
        <Link href="/dashboard" className="cancel-btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </CancelShell>
  );
}
