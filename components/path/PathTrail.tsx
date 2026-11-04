"use client";

// Vertical S-curve trail. Walks PATH_ITEMS once, assigns every item a
// (y, offset) coordinate, then renders:
//   1) one SVG layer with a gold-dotted path connecting every node center;
//   2) one absolutely-positioned layer with the nodes / chest / trophy;
//   3) a single floating detail card under the active (clicked) node.
//
// Layout knobs are centralized at the top of the component so both layers
// (SVG and absolute positioning) agree on every y and x.

import { useMemo, useState } from "react";
import Link from "next/link";
import PathNode, { type NodeState } from "./PathNode";
import PathMascot from "./PathMascot";
import { PATH_ITEMS, TOTAL_STEPS, type PathItem } from "@/lib/path/steps";

type Props = {
  /** 1..TOTAL_STEPS+1. Previous steps show done; this one shows current.
      TOTAL_STEPS+1 (8) means every step is complete and the trophy is live. */
  currentStep: number;
};

/** Layout constants. Both the SVG layer and the node layer read these. */
const COLUMN_WIDTH = 320;       // visual column the sine curve sways through
const ROW_HEIGHT = 128;         // vertical distance between rows
const CARD_GAP = 14;            // gap between a node and its detail card
const CARD_HEIGHT_RESERVE = 140; // reserve so a card near the bottom still fits
const AMPLITUDE = 70;           // sine amplitude (left/right swing)
const CENTER_X = COLUMN_WIDTH / 2;
const FIRST_Y = 70;             // first-node baseline so STARTtag + ring fit

type Coord = { x: number; y: number };

function stateFor(item: PathItem, currentStep: number): NodeState | null {
  if (item.kind === "chest") {
    // Chest sits between two numbered steps. "Opened" when the step BEFORE
    // the chest is done. Approximated here by checking the preceding item:
    // the caller supplies the index, see useMemo below.
    return null;
  }
  if (item.kind === "trophy") {
    return currentStep > TOTAL_STEPS ? "done" : "locked";
  }
  if (item.num < currentStep) return "done";
  if (item.num === currentStep) return "current";
  return "locked";
}

export default function PathTrail({ currentStep }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Precompute every item's x/y and its state. Chest state is derived from
  // the nearest preceding step in a second pass.
  const nodes = useMemo(() => {
    let previousStepDone = false;
    return PATH_ITEMS.map((item, i) => {
      const y = FIRST_Y + i * ROW_HEIGHT;
      // Alternate left/right with a sine so the trail S-curves rather than
      // zig-zags. Slight phase shift so the first node sits slightly off-axis.
      const x = CENTER_X + Math.sin(i * 0.9 + 0.3) * AMPLITUDE;
      let state: NodeState = "locked";
      if (item.kind === "step") {
        const computed = stateFor(item, currentStep);
        state = computed ?? "locked";
        previousStepDone = state === "done";
      } else if (item.kind === "trophy") {
        state = currentStep > TOTAL_STEPS ? "done" : "locked";
      } else {
        // Chest: "open" style when the step immediately before is done.
        state = previousStepDone ? "done" : "locked";
      }
      const side: "left" | "right" = x < CENTER_X ? "left" : "right";
      return { item, x, y, state, side };
    });
  }, [currentStep]);

  const svgHeight =
    FIRST_Y + (PATH_ITEMS.length - 1) * ROW_HEIGHT + CARD_HEIGHT_RESERVE;

  // Dotted path between every consecutive node center. Smooth-ish via
  // midpoint quadratic bezier so the sine curve doesn't read as a polyline.
  const pathD = useMemo(() => {
    const coords: Coord[] = nodes.map((n) => ({ x: n.x, y: n.y }));
    if (coords.length === 0) return "";
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const midY = (prev.y + cur.y) / 2;
      // Control point pulls the curve toward the midpoint vertically and the
      // current x horizontally, which gives a soft S between any two nodes.
      d += ` Q ${cur.x} ${midY} ${cur.x} ${cur.y}`;
    }
    return d;
  }, [nodes]);

  return (
    <div
      style={{
        position: "relative",
        width: COLUMN_WIDTH,
        maxWidth: "100%",
        margin: "16px auto 0",
        minHeight: svgHeight,
      }}
    >
      <svg
        width={COLUMN_WIDTH}
        height={svgHeight}
        viewBox={`0 0 ${COLUMN_WIDTH} ${svgHeight}`}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {/* Dotted trail. 4 4 dash array at 3px stroke reads as beads at mobile
            viewport widths without blurring. */}
        <path
          d={pathD}
          fill="none"
          stroke="rgba(229,181,71,0.55)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="4 8"
        />
      </svg>

      {/* Node + marker layer */}
      <div style={{ position: "relative", width: "100%", height: svgHeight }}>
        {nodes.map(({ item, x, y, state, side }) => {
          const nodeWidth = state === "current" ? 86 : 76;
          // Absolute left/top anchors the CIRCLE center at (x, y), and the
          // label flows below it from the component itself.
          const style: React.CSSProperties = {
            position: "absolute",
            left: x - nodeWidth / 2,
            top: y - nodeWidth / 2,
          };

          if (item.kind === "chest") {
            return (
              <div key={item.id} style={style}>
                <Chest open={state === "done"} />
              </div>
            );
          }
          if (item.kind === "trophy") {
            return (
              <div key={item.id} style={style}>
                <Trophy active={state === "done"} label={item.title} />
              </div>
            );
          }

          const isActive = activeId === item.id;
          return (
            <div key={item.id}>
              <div style={style}>
                <PathNode
                  state={state}
                  icon={item.icon}
                  label={item.title}
                  onClick={() => {
                    if (state === "locked") return;
                    setActiveId((prev) => (prev === item.id ? null : item.id));
                  }}
                />
              </div>

              {/* Mascot rides the current step. Sits opposite the sine side
                  so it never covers the node, and never attaches to a
                  locked or done node. */}
              {state === "current" && (
                <div
                  style={{
                    position: "absolute",
                    top: y - 10,
                    left: side === "right" ? x - 170 : x + 50,
                    pointerEvents: "none",
                  }}
                >
                  <PathMascot line={item.mascotLine} side={side === "right" ? "left" : "right"} />
                </div>
              )}

              {/* Detail card under the active node */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    top: y + nodeWidth / 2 + CARD_GAP + 22, // + label row
                    left: 10,
                    right: 10,
                    background: "var(--card-dark)",
                    border: "1px solid var(--line-dark-hi)",
                    borderRadius: 16,
                    padding: "14px 16px 14px",
                    boxShadow: "0 18px 40px -16px rgba(0,0,0,0.7)",
                    animation: "pathcard-in 180ms ease-out",
                  }}
                >
                  <p
                    style={{
                      fontFamily: '"Cabinet Grotesk", "Inter", sans-serif',
                      fontWeight: 800,
                      fontSize: 15,
                      color: "var(--txt-dark-hi)",
                      margin: 0,
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 10px",
                      fontSize: 13,
                      color: "var(--mut-dark-hi)",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.description}
                  </p>
                  <Link
                    href={item.href}
                    style={{
                      display: "inline-block",
                      background: "var(--cta)",
                      color: "var(--cta-text)",
                      fontFamily: '"Cabinet Grotesk", "Inter", sans-serif',
                      fontWeight: 800,
                      fontSize: 13,
                      letterSpacing: "0.04em",
                      padding: "9px 18px",
                      borderRadius: 999,
                      textDecoration: "none",
                      boxShadow: "0 8px 20px -6px rgba(229,181,71,0.5)",
                    }}
                  >
                    Start
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes pathcard-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Chest: milestone marker between step groups ────────────────────────────
function Chest({ open }: { open: boolean }) {
  const lid = open ? "#FFE89A" : "#5a4f42";
  const body = open ? "#C9A14A" : "#2a2834";
  const trim = open ? "#B8881F" : "#3d3a4a";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        width={76}
        height={76}
        viewBox="0 0 76 76"
        aria-hidden
        style={{
          filter: open
            ? "drop-shadow(0 6px 20px rgba(229,181,71,0.5))"
            : "drop-shadow(0 6px 14px rgba(0,0,0,0.6))",
        }}
      >
        {/* Chest body */}
        <rect x="12" y="34" width="52" height="28" rx="6" fill={body} stroke={trim} strokeWidth="2.5" />
        {/* Lid */}
        <path
          d={open ? "M12 34 Q12 18 26 20 L50 20 Q64 18 64 34 Z" : "M12 34 Q12 22 24 22 L52 22 Q64 22 64 34 Z"}
          fill={lid}
          stroke={trim}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Lock plate */}
        <rect x="34" y="40" width="8" height="10" rx="1.5" fill={trim} />
        <circle cx="38" cy="43" r="1.6" fill={body} />
        {/* Metal bands */}
        <rect x="12" y="46" width="52" height="3" fill={trim} />
        {/* Glow dots when open */}
        {open && (
          <>
            <circle cx="20" cy="18" r="2" fill="#FFE89A" opacity="0.9" />
            <circle cx="56" cy="16" r="1.6" fill="#FFE89A" opacity="0.8" />
            <circle cx="64" cy="26" r="1.4" fill="#FFE89A" opacity="0.7" />
          </>
        )}
      </svg>
      <span
        style={{
          marginTop: 6,
          fontFamily: '"Cabinet Grotesk", "Inter", sans-serif',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: open ? "var(--gold-bright)" : "var(--mut-dark)",
        }}
      >
        {open ? "Reward" : "Locked"}
      </span>
    </div>
  );
}

// ─── Trophy: end-of-path capstone ───────────────────────────────────────────
function Trophy({ active, label }: { active: boolean; label: string }) {
  const cup = active ? "#E5B547" : "#2a2834";
  const rim = active ? "#FFE89A" : "#3d3a4a";
  const base = active ? "#8a6a24" : "#1c1922";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        width={92}
        height={92}
        viewBox="0 0 92 92"
        aria-hidden
        style={{
          filter: active
            ? "drop-shadow(0 8px 24px rgba(229,181,71,0.6))"
            : "drop-shadow(0 6px 14px rgba(0,0,0,0.6))",
        }}
      >
        {/* Handles */}
        <path
          d="M22 24 Q10 24 10 38 Q10 50 24 50"
          fill="none"
          stroke={rim}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M70 24 Q82 24 82 38 Q82 50 68 50"
          fill="none"
          stroke={rim}
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Cup */}
        <path
          d="M22 20 L70 20 L68 46 Q68 62 46 62 Q24 62 24 46 Z"
          fill={cup}
          stroke={rim}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Stem */}
        <rect x="40" y="62" width="12" height="10" fill={base} />
        {/* Base */}
        <rect x="28" y="72" width="36" height="8" rx="2" fill={base} stroke={rim} strokeWidth="2.5" />
        {/* Star */}
        <path
          d="M46 30 L49 37 L56 38 L51 43 L52 50 L46 47 L40 50 L41 43 L36 38 L43 37 Z"
          fill={active ? "#FFF8E7" : "#3d3a4a"}
        />
      </svg>
      <span
        style={{
          marginTop: 6,
          fontFamily: '"Cabinet Grotesk", "Inter", sans-serif',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: active ? "var(--gold-bright)" : "var(--mut-dark)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
