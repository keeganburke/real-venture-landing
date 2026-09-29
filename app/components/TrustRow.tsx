import { TRUST_COUNTS } from "@/app/lib/whop-reviews";

// Trust badges under the primary CTAs. The Whop badge is deliberately NOT a
// link: keeping visitors on realventure.io instead of Whop's product page.
export default function TrustRow() {
  return (
    <div className="trust-row">
      <span className="trust-badge trust-badge-whop">
        <span aria-label="5 stars" className="trust-stars">★★★★★</span>
        <img src="/whoplogo3.png" alt="Whop" className="trust-whop-logo" width={18} height={18} />
        <span className="trust-count trust-reviews-count">{`(${TRUST_COUNTS.reviews} reviews)`}</span>
      </span>
    </div>
  );
}
