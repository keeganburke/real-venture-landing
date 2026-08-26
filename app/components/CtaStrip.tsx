"use client";

// Repeating CTA + social proof strip (TRW pattern), rendered 4x per page.
// Avatars live at /public/avatars/first..fourth.png; gradient circles render
// as fallback if a file goes missing.
const AVATARS = [
  { file: "first", fallback: "linear-gradient(135deg,#FFE89A,#B8881F)" },
  { file: "second", fallback: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
  { file: "third", fallback: "linear-gradient(135deg,#5FB3E0,#3b82f6)" },
  { file: "fourth", fallback: "linear-gradient(135deg,#4ade80,#16a34a)" },
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
          {AVATARS.map((avatar) => (
            <span
              className="lp-avatar"
              key={avatar.file}
              style={{ background: `url(/avatars/${avatar.file}.png) center/cover, ${avatar.fallback}` }}
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
