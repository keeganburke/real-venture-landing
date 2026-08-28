"use client";

import Link from "next/link";
import type { Course } from "./learn-types";

const CATEGORIES = [
  { key: "beginner", emoji: "🌱", label: "Beginner" },
  { key: "intermediate", emoji: "💪", label: "Intermediate" },
  { key: "advanced", emoji: "🧠", label: "Advanced" },
  { key: "bonus", emoji: "🎁", label: "Bonus" },
] as const;

type Props = {
  courses: Course[];
  lessonCounts: Record<string, number>;
  completedCounts: Record<string, number>;
};

function courseStatus(done: number, total: number) {
  if (total > 0 && done >= total) return "Complete";
  if (done > 0) return "In progress";
  return "Not started";
}

export default function LearnClient({ courses, lessonCounts, completedCounts }: Props) {
  const totalLessons = Object.values(lessonCounts).reduce((sum, n) => sum + n, 0);
  const totalCompleted = Object.values(completedCounts).reduce((sum, n) => sum + n, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <div className="hub-page learn-page">
      <div className="learn-shell">
        <Link className="learn-back" href="/dashboard">
          {"←"} Hub
        </Link>
        <header className="learn-header">
          <h1 className="learn-title">Learn Wholesaling</h1>
          <p className="learn-sub">Pick a section to get started</p>
        </header>

        <div className="learn-stats-grid">
          <div className="learn-stat-card">
            <span className="learn-stat-icn">📚</span>
            <span className="learn-stat-num">{courses.length}</span>
            <span className="learn-stat-lbl">Courses {"·"} {overallPct}% complete</span>
          </div>
          <div className="learn-stat-card">
            <span className="learn-stat-icn">🎓</span>
            <span className="learn-stat-num">{totalCompleted}/{totalLessons}</span>
            <span className="learn-stat-lbl">Lessons completed</span>
          </div>
          <div className="learn-stat-card locked">
            <span className="learn-stat-icn">❓</span>
            <span className="learn-stat-num">🔒</span>
            <span className="learn-stat-lbl">Quizzes {"·"} coming soon</span>
          </div>
          <div className="learn-stat-card locked">
            <span className="learn-stat-icn">🎥</span>
            <span className="learn-stat-num">🔒</span>
            <span className="learn-stat-lbl">Videos {"·"} coming soon</span>
          </div>
        </div>

        {CATEGORIES.map((cat) => {
          const catCourses = courses.filter((course) => course.category === cat.key);
          if (catCourses.length === 0) return null;
          return (
            <section className="learn-section" key={cat.key}>
              <div className="learn-section-head">
                <span className="learn-section-emoji">{cat.emoji}</span>
                {cat.label}
              </div>
              {catCourses.map((course, index) => {
                const total = lessonCounts[course.id] ?? 0;
                const done = completedCounts[course.id] ?? 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const status = courseStatus(done, total);
                return (
                  <Link
                    className="learn-course-card"
                    href={`/dashboard/learn/${course.slug}`}
                    key={course.id}
                    style={{ "--i": String(index) } as React.CSSProperties}
                  >
                    <div className="learn-course-thumb">📚</div>
                    <div className="learn-course-meta">
                      <div className="learn-course-title">
                        {course.title}
                        {course.tier === "pro" && <span className="learn-pro-badge">PRO</span>}
                      </div>
                      <div className="learn-course-status">
                        {status} {"·"} {done} of {total} lessons
                      </div>
                    </div>
                    <div className="learn-course-progress">
                      <span className={`learn-course-pct${status === "Complete" ? " done" : ""}`}>
                        {done}/{total}
                      </span>
                      <span className="learn-course-bar">
                        <span
                          className={`learn-course-fill${status === "Complete" ? " done" : ""}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
