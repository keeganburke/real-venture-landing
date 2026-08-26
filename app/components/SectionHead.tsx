import type { ReactNode } from "react";

// Editorial section pattern: tiny eyebrow, big H2, one-line sub.
type Props = {
  eyebrow: string;
  heading: ReactNode;
  sub: string;
};

export default function SectionHead({ eyebrow, heading, sub }: Props) {
  return (
    <div className="lp-section-head">
      <span className="lp-section-eyebrow">{eyebrow}</span>
      <h2 className="lp-section-h2">{heading}</h2>
      <p className="lp-section-sub">{sub}</p>
    </div>
  );
}
