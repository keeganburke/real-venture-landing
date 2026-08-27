import wins from "../wins-manifest.json";

// Auto-scroll payout marquee. The manifest is generated from public/wins/ by
// scripts/gen-wins-manifest.mjs (prebuild hook); the list renders twice so the
// -50% keyframe loops seamlessly.
export default function PayoutCarousel() {
  return (
    <div className="lp-payout-marquee">
      <div className="lp-payout-track">
        {[...wins, ...wins].map((w, idx) => (
          <div className="lp-payout-card" key={idx}>
            <div className="lp-payout-img-wrap">
              <img src={`/wins/${w.file}`} alt={`${w.name} payout`} className="lp-payout-img" />
            </div>
            <div className="lp-payout-caption">
              <span className="lp-payout-name">{w.name}</span>
              <span className="lp-payout-fee">${w.amount.toLocaleString("en-US")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
