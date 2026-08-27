// Lesson player skeleton. Renders instantly while the player's server chain
// runs (session verify + course fetch + parallel lessons/progress fetch).
// Wrapper class matches LessonClient so the immersive dark canvas stays
// consistent through the navigation swap.

export default function LessonLoading() {
  return (
    <div className="lesson-page">
      <header className="lesson-topbar">
        <div className="rv-skel" style={{ width: "180px", height: "14px" }} />
        <div className="rv-skel" style={{ width: "100px", height: "12px" }} />
      </header>

      <div className="lesson-shell">
        <aside className="lesson-sidebar">
          <div className="rv-skel" style={{ width: "60px", height: "10px", margin: "0 0 16px 12px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rv-skel" style={{ height: "48px", borderRadius: "10px" }} />
            ))}
          </div>
        </aside>

        <main className="lesson-main">
          <div className="rv-skel rv-skel-title" style={{ width: "70%", height: "42px" }} />
          <div className="rv-skel" style={{ width: "80%", height: "16px", marginTop: "16px" }} />

          <div className="lesson-blocks" style={{ marginTop: "40px" }}>
            <div className="rv-skel" style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "14px" }} />
            <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="rv-skel" style={{ width: "100%", height: "16px" }} />
              <div className="rv-skel" style={{ width: "95%", height: "16px" }} />
              <div className="rv-skel" style={{ width: "88%", height: "16px" }} />
              <div className="rv-skel" style={{ width: "92%", height: "16px" }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
