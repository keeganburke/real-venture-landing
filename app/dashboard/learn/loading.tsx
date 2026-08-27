// Catalog skeleton. Renders instantly while /dashboard/learn's server work
// (auth + 3 Supabase queries in one Promise.all) completes. Uses the same
// wrapper class as LearnClient so background + grid overlay match.

export default function LearnLoading() {
  return (
    <div className="hub-page learn-page">
      <div className="learn-shell">
        <header className="learn-header">
          <div className="rv-skel rv-skel-title" style={{ width: "320px", height: "44px" }} />
          <div className="rv-skel" style={{ width: "220px", height: "16px", marginTop: "12px" }} />
        </header>

        <div className="learn-stats-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rv-skel rv-skel-card" style={{ height: "108px" }} />
          ))}
        </div>

        {["Beginner", "Intermediate", "Advanced", "Bonus"].map((label) => (
          <section key={label} className="learn-section">
            <div className="rv-skel" style={{ width: "140px", height: "14px", marginBottom: "16px" }} />
            <div className="rv-skel rv-skel-card" style={{ height: "104px", marginBottom: "12px" }} />
          </section>
        ))}
      </div>
    </div>
  );
}
