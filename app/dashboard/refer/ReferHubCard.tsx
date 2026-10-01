import Link from "next/link";

// Hub card that sends members to /dashboard/refer. Same structure and classes
// as the Real Venture Studio card (hub2-studio*), minus the dismiss button.
// Purely static: the affiliate setup only runs on the refer page itself.
export default function ReferHubCard() {
  return (
    <section className="hub2-studio" aria-label="Refer and earn">
      <div className="hub2-studio-icon" aria-hidden="true">
        <img src="/crowns/pro.png" alt="" className="refer-hubcard-crown" width={30} height={26} />
      </div>
      <div className="hub2-studio-title">Refer &amp; Earn</div>
      <p className="hub2-studio-sub">Earn $10 to $125 for every friend who joins.</p>
      <Link href="/dashboard/refer" className="hub2-studio-cta">
        <span>Get my link</span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
