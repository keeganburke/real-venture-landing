import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real Venture | Tools & Resources",
};

export default function ResourcesPage() {
  return (
    <div className="hub2-page">
      <div className="hub2-shell hub2-placeholder">
        <h1 className="hub2-placeholder-title">Tools & Resources</h1>
        <p className="hub2-placeholder-sub">
          Contracts, scripts, and checklists coming here soon. For now, everything lives in the Discord.
        </p>
        <a href="https://whop.com/realventure/" target="_blank" rel="noopener noreferrer" className="hub2-placeholder-cta">
          Open Discord ↗
        </a>
      </div>
    </div>
  );
}
