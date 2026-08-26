import type { ReactNode } from "react";

// Editorial section pattern: big H2 + one-line sub. The eyebrow slot is
// optional and currently unused everywhere (removed in the mobile polish
// pass); its CSS class survives in globals.css in case it comes back.
type Props = {
  eyebrow?: string;
  heading: ReactNode;
  sub: string;
};

export default function SectionHead({ eyebrow, heading, sub }: Props) {
  return (
    <div className="lp-section-head">
      {eyebrow && <span className="lp-section-eyebrow">{eyebrow}</span>}
      <h2 className="lp-section-h2">{heading}</h2>
      <p className="lp-section-sub">{sub}</p>
    </div>
  );
}
