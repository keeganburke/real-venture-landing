// Trust badges under the primary CTAs. The Whop badge is deliberately NOT a
// link: keeping visitors on realventure.io instead of Whop's product page.
export default function TrustRow() {
  return (
    <div className="trust-row">
      <span className="trust-badge trust-badge-whop">
        <span className="trust-star trust-star-gold">★</span>
        5.0 on Whop
        <span className="trust-count">(51 reviews)</span>
      </span>
      <span className="trust-dot" aria-hidden="true">•</span>
      <a
        className="trust-badge trust-badge-trustpilot"
        href="https://www.trustpilot.com/review/realventure.io"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="trust-star trust-star-green">★</span>
        4.6 on Trustpilot
        <span className="trust-count">(17 reviews)</span>
      </a>
    </div>
  );
}
