"use client";

// Repeating CTA + social proof strip (TRW pattern), rendered 4x per page.
// TODO: Keegan drops 1.png, 2.png, 3.png, 4.png (200x200+) into
// /public/avatars/, gradient circles render until then.
const AVATAR_FALLBACKS = [
  "linear-gradient(135deg,#FFE89A,#B8881F)",
  "linear-gradient(135deg,#a78bfa,#7c3aed)",
  "linear-gradient(135deg,#5FB3E0,#3b82f6)",
  "linear-gradient(135deg,#4ade80,#16a34a)",
];

type Props = {
  onJoin: () => void;
  label?: string;
};

export default function CtaStrip({ onJoin, label = "Join for $19.99/mo →" }: Props) {
  return (
    <div className="lp-cta-strip">
      <button className="lp-cta-primary" onClick={onJoin}>
        {label}
      </button>
      <div className="lp-social">
        <div className="lp-avatars">
          {AVATAR_FALLBACKS.map((fallback, i) => (
            <span
              className="lp-avatar"
              key={i}
              style={{ background: `url(/avatars/${i + 1}.png) center/cover, ${fallback}` }}
            />
          ))}
        </div>
        <div className="lp-social-lbl">
          <b>300+</b> active students
        </div>
      </div>
    </div>
  );
}
