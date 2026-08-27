// Course-detail skeleton. Renders instantly while [courseSlug]/page.tsx
// runs its two DB waves (course → then lessons+progress). Wrapper class
// matches CourseClient so the background/grid stay stable across the swap.

export default function CourseLoading() {
  return (
    <div className="hub-page learn-page">
      <div className="learn-shell">
        <div className="rv-skel" style={{ width: "120px", height: "16px", marginBottom: "24px" }} />

        <header className="learn-course-head">
          <div className="rv-skel rv-skel-title" style={{ width: "280px", height: "40px" }} />
          <div className="rv-skel" style={{ width: "460px", height: "16px", marginTop: "12px" }} />
          <div className="rv-skel" style={{ width: "220px", height: "14px", marginTop: "20px" }} />
        </header>

        <div className="learn-lesson-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rv-skel rv-skel-card" style={{ height: "112px" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
