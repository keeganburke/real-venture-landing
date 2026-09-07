// Trust badges under the primary CTAs. The Whop badge is deliberately NOT a
// link: keeping visitors on realventure.io instead of Whop's product page.
export default function TrustRow() {
  return (
    <div className="trust-row">
      <span className="trust-badge trust-badge-whop">
        <span className="trust-star trust-star-gold">★</span>
        5.0 on Whop
        <span className="trust-count">(53 reviews)</span>
      </span>
    </div>
  );
}
