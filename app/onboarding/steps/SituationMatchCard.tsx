"use client";

export type Situation = "full_time" | "part_time" | "not_working" | "in_school";

// Hardcoded testimonial per situation (no data lookup yet). in_school and
// not_working share Dylan's card on purpose.
const CARDS: Record<Situation, { name: string; story: string }> = {
  full_time: {
    name: "Eves",
    story: "Eves closed a deal while working 70 hours a week in fast food.",
  },
  in_school: {
    name: "Dylan",
    story: "Dylan closed almost $50,000 in assignment fees as a college student at 20.",
  },
  not_working: {
    name: "Dylan",
    story: "Dylan closed almost $50,000 in assignment fees as a college student at 20.",
  },
  part_time: {
    name: "Mello",
    story: "Mello, 17, closed a $16,000 deal working part time on the side.",
  },
};

type Props = {
  situation: Situation;
  onBack?: () => void;
  onContinue: () => void;
};

// Display-only interstitial between the situation question and the scale.
// Not an intake question: collects nothing, does not count toward the total,
// so it uses the same .intake chrome minus the progress bar.
export default function SituationMatchCard({ situation, onBack, onContinue }: Props) {
  const card = CARDS[situation];
  return (
    <div className="intake">
      <div className="intake-q">Meet someone like you.</div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          padding: "20px",
          borderRadius: "16px",
          background: "var(--card, #16161c)",
          border: "1.5px solid var(--line, #26262e)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "16px",
            background: "#262626",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: '"Cabinet Grotesk", sans-serif',
              fontWeight: 800,
              fontSize: "18px",
              color: "var(--gold, #E5B547)",
              marginBottom: "6px",
            }}
          >
            {card.name}
          </div>
          <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.5, color: "var(--txt, #ffffff)" }}>
            {card.story}
          </p>
        </div>
      </div>

      <p
        style={{
          margin: "18px 0 0",
          fontSize: "14px",
          color: "var(--txt-mut, rgba(255,255,255,.6))",
        }}
      >
        {"This is what's possible with your starting point."}
      </p>

      <div className="intake-foot">
        <div className="foot-left">
          {onBack && (
            <button className="foot-back" onClick={onBack}>
              {"← Back"}
            </button>
          )}
        </div>
        <button className="foot-next" onClick={onContinue}>
          {"Continue →"}
        </button>
      </div>
    </div>
  );
}
