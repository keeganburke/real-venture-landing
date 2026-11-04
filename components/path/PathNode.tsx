"use client";

// Round chunky 3D button, Duolingo-style. States:
//   done    — solid gold #C9A14A with a white check
//   current — brighter gold ring + pulse + "START" tag above
//   locked  — charcoal, muted icon, not clickable
//
// The press-down affordance is the thick darker bottom edge (box-shadow inset
// 0 -6 … below the circle). The button nudges that shadow smaller on active,
// so it visibly "presses in". No external deps — hover/active are CSS only.
//
// Clicking a done or current node opens a small card UNDER the node with the
// title, description, and a gold "Start" CTA. The card is rendered by the
// parent (PathTrail) based on the active id, so only one card is open at a
// time across the whole trail.

import type { PathIcon } from "@/lib/path/steps";

export type NodeState = "done" | "current" | "locked";

type Props = {
  state: NodeState;
  icon: PathIcon;
  label: string;
  onClick?: () => void;
  size?: number; // circle diameter in px, defaults to 76 (current gets 86)
};

function IconSvg({ icon, color }: { icon: PathIcon; color: string }) {
  const s = 28;
  const stroke = color;
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (icon) {
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5z" />
          <path d="M8 10h8M8 13h5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
          <circle cx="12" cy="14.5" r="1.1" fill={stroke} stroke="none" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5l6 3.5-6 3.5z" fill={stroke} stroke="none" />
        </svg>
      );
    case "gamepad":
      return (
        <svg {...common}>
          <path d="M4 10c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v4c0 1.7-1.3 3-3 3-1 0-1.9-.5-2.4-1.3L14 15h-4l-.6.7C8.9 16.5 8 17 7 17c-1.7 0-3-1.3-3-3v-4z" />
          <path d="M8 10v3M6.5 11.5h3" />
          <circle cx="15.5" cy="11.5" r="0.9" fill={stroke} stroke="none" />
          <circle cx="17.5" cy="13" r="0.9" fill={stroke} stroke="none" />
        </svg>
      );
    case "calculator":
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <rect x="7.5" y="5.5" width="9" height="3" rx="0.6" />
          <circle cx="9" cy="12" r="0.9" fill={stroke} stroke="none" />
          <circle cx="12" cy="12" r="0.9" fill={stroke} stroke="none" />
          <circle cx="15" cy="12" r="0.9" fill={stroke} stroke="none" />
          <circle cx="9" cy="15" r="0.9" fill={stroke} stroke="none" />
          <circle cx="12" cy="15" r="0.9" fill={stroke} stroke="none" />
          <circle cx="15" cy="15" r="0.9" fill={stroke} stroke="none" />
          <circle cx="9" cy="18" r="0.9" fill={stroke} stroke="none" />
          <circle cx="12" cy="18" r="0.9" fill={stroke} stroke="none" />
          <circle cx="15" cy="18" r="0.9" fill={stroke} stroke="none" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M4.5 5.5a2 2 0 012-2h2.4l2 4.5-2.1 1.3a11 11 0 005.9 5.9l1.3-2.1 4.5 2v2.4a2 2 0 01-2 2A14.5 14.5 0 014.5 5.5z" />
        </svg>
      );
    case "document":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v13a1.5 1.5 0 01-1.5 1.5h-9.5A1.5 1.5 0 015.5 20V4.5A1.5 1.5 0 017 3z" />
          <path d="M14 3v4h4" />
          <path d="M8.5 13s1.2-.7 2 .3c.8 1 1.6 1.4 2.6.9 1-.5 1.7-.2 2.4.6" />
        </svg>
      );
  }
}

/**
 * Colors per state. The done fill is literally #C9A14A per the spec (not an
 * existing CSS token). The locked fill reuses --card-dark so it sits flush
 * against the page background without reading as a solid button.
 */
const STATE_STYLE: Record<
  NodeState,
  { fill: string; stroke: string; iconColor: string; shadow: string; textColor: string }
> = {
  done: {
    fill: "#C9A14A",
    stroke: "#FFE89A",
    iconColor: "#FFFFFF",
    shadow: "#8a6a24",
    textColor: "var(--txt-dark-hi)",
  },
  current: {
    fill: "var(--gold)",
    stroke: "var(--gold-bright)",
    iconColor: "#1a1208",
    shadow: "var(--gold-deep)",
    textColor: "var(--gold-bright)",
  },
  locked: {
    fill: "var(--card-dark)",
    stroke: "var(--line-dark-hi)",
    iconColor: "var(--mut-dark)",
    shadow: "var(--bg-deep)",
    textColor: "var(--mut-dark)",
  },
};

export default function PathNode({ state, icon, label, onClick, size }: Props) {
  const s = size ?? (state === "current" ? 86 : 76);
  const style = STATE_STYLE[state];
  const clickable = state !== "locked";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "auto",
      }}
    >
      {state === "current" && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -26,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: '"Cabinet Grotesk", "Inter", sans-serif',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            color: "var(--cta-text)",
            background: "var(--cta)",
            padding: "4px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 18px -4px rgba(229,181,71,0.55)",
            textTransform: "uppercase",
          }}
        >
          Start
        </span>
      )}

      <button
        type="button"
        aria-label={label}
        aria-disabled={!clickable}
        disabled={!clickable}
        onClick={clickable ? onClick : undefined}
        className={state === "current" ? "pathnode--current" : undefined}
        style={{
          width: s,
          height: s,
          borderRadius: "50%",
          background: style.fill,
          border: `3px solid ${style.stroke}`,
          cursor: clickable ? "pointer" : "default",
          display: "grid",
          placeItems: "center",
          padding: 0,
          position: "relative",
          color: style.iconColor,
          // 3D bottom edge: inset shadow creates a darker rim under the ball.
          boxShadow: `0 6px 0 0 ${style.shadow}, 0 10px 18px -8px rgba(0,0,0,0.6)`,
          transform: "translateY(-6px)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
        }}
        onPointerDown={(e) => {
          if (!clickable) return;
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 0 0 ${style.shadow}, 0 6px 12px -8px rgba(0,0,0,0.6)`;
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-6px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 0 0 ${style.shadow}, 0 10px 18px -8px rgba(0,0,0,0.6)`;
        }}
        onPointerLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-6px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 0 0 ${style.shadow}, 0 10px 18px -8px rgba(0,0,0,0.6)`;
        }}
      >
        {state === "done" ? (
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12l4.5 4.5L19 7"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <IconSvg icon={icon} color={style.iconColor} />
        )}
      </button>

      <span
        style={{
          marginTop: 10,
          fontSize: 12,
          fontWeight: 600,
          color: style.textColor,
          textAlign: "center",
          maxWidth: 140,
          lineHeight: 1.25,
        }}
      >
        {label}
      </span>

      <style>{`
        .pathnode--current::before {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 2px solid rgba(229,181,71,0.55);
          animation: pathnode-pulse 1800ms ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes pathnode-pulse {
          0%   { transform: scale(1);   opacity: 0.75; }
          50%  { transform: scale(1.12); opacity: 0.15; }
          100% { transform: scale(1);   opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
