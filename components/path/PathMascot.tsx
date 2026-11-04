"use client";

// Placeholder buddy for the path preview. Original SVG only — a round
// gold-and-black creature with two big eyes, nothing resembling an existing
// mascot. The `src` prop lets a real PNG under public/mascot/ drop in later
// without touching callers.
//
// The mascot sits beside the active node and speaks ONE line per numbered
// step (passed in from PathTrail). Idle animation is a gentle vertical bob;
// the speech bubble fades in with a short delay so the visual order reads
// mascot → bubble, not both at once.

type Props = {
  /** Line to say next to the mascot. Kept short — one sentence. */
  line: string;
  /** Optional swap-in image. When set, replaces the inline SVG entirely. */
  src?: string;
  /** "left" places the mascot on the left side of the node, "right" on the
      right. The speech bubble sits on the opposite side so it never covers
      the circle. */
  side?: "left" | "right";
};

function MascotSvg() {
  // Original design: a round body (gold ring, dark core), two big white eyes
  // with gold pupils, a tiny bow-tie detail. Nothing that reads as another
  // brand's mascot.
  return (
    <svg
      viewBox="0 0 120 120"
      width={88}
      height={88}
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="pm-body" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#2a2010" />
          <stop offset="70%" stopColor="#1a1208" />
          <stop offset="100%" stopColor="#0d0906" />
        </radialGradient>
        <linearGradient id="pm-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE89A" />
          <stop offset="55%" stopColor="#E5B547" />
          <stop offset="100%" stopColor="#B8881F" />
        </linearGradient>
      </defs>

      {/* Base shadow */}
      <ellipse cx="60" cy="108" rx="28" ry="5" fill="rgba(0,0,0,0.35)" />

      {/* Body ring */}
      <circle cx="60" cy="58" r="44" fill="url(#pm-ring)" />
      <circle cx="60" cy="58" r="36" fill="url(#pm-body)" />

      {/* Eye whites */}
      <circle cx="46" cy="54" r="10" fill="#F4E9D0" />
      <circle cx="74" cy="54" r="10" fill="#F4E9D0" />

      {/* Pupils (gold, with a highlight) */}
      <circle cx="47" cy="55" r="4.5" fill="#1a1208" />
      <circle cx="75" cy="55" r="4.5" fill="#1a1208" />
      <circle cx="48.5" cy="53.5" r="1.4" fill="#FFE89A" />
      <circle cx="76.5" cy="53.5" r="1.4" fill="#FFE89A" />

      {/* Little smile */}
      <path
        d="M50 72 Q60 80 70 72"
        stroke="#F4E9D0"
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />

      {/* Tiny bow-tie detail */}
      <path
        d="M54 88 L60 84 L66 88 L60 92 Z"
        fill="#E5B547"
        stroke="#B8881F"
        strokeWidth={1}
      />
    </svg>
  );
}

export default function PathMascot({ line, src, side = "right" }: Props) {
  const flex = side === "right" ? "row" : "row-reverse";

  return (
    <div
      className="pathmascot"
      style={{
        display: "flex",
        flexDirection: flex,
        alignItems: "flex-end",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <div
        className="pathmascot__body"
        style={{
          width: 88,
          height: 88,
          flexShrink: 0,
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))",
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={88} height={88} style={{ display: "block" }} />
        ) : (
          <MascotSvg />
        )}
      </div>

      <div
        className="pathmascot__bubble"
        style={{
          position: "relative",
          background: "var(--card-dark)",
          border: "1px solid var(--line-dark-hi)",
          borderRadius: 14,
          padding: "8px 12px",
          maxWidth: 180,
          fontSize: 12.5,
          lineHeight: 1.35,
          color: "var(--txt-dark-hi)",
          boxShadow: "0 10px 24px -14px rgba(0,0,0,0.7)",
        }}
      >
        {line}
        {/* Bubble tail: a small diamond pointing back at the mascot */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            [side === "right" ? "left" : "right"]: -6,
            transform: "translateY(-50%) rotate(45deg)",
            width: 10,
            height: 10,
            background: "var(--card-dark)",
            borderLeft:
              side === "right" ? "1px solid var(--line-dark-hi)" : "none",
            borderBottom:
              side === "right" ? "1px solid var(--line-dark-hi)" : "none",
            borderRight:
              side === "left" ? "1px solid var(--line-dark-hi)" : "none",
            borderTop:
              side === "left" ? "1px solid var(--line-dark-hi)" : "none",
          }}
        />
      </div>

      <style>{`
        .pathmascot__body { animation: pathmascot-bob 2800ms ease-in-out infinite; }
        @keyframes pathmascot-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .pathmascot__bubble {
          opacity: 0;
          animation: pathmascot-bubble-in 500ms ease-out 180ms forwards;
        }
        @keyframes pathmascot-bubble-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
