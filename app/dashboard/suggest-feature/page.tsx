import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real Venture | Suggest a Feature",
};

export default function SuggestFeaturePage() {
  return (
    <div className="hub2-page">
      <div className="hub2-shell hub2-placeholder">
        <h1 className="hub2-placeholder-title">Suggest a feature</h1>
        <p className="hub2-placeholder-sub">
          Feature request form coming here soon. For now, share ideas in Discord and Keegan will pick them up.
        </p>
        <a href="/api/discord/connect" target="_blank" rel="noopener noreferrer" className="hub2-placeholder-cta">
          Open Discord ↗
        </a>
      </div>
    </div>
  );
}
