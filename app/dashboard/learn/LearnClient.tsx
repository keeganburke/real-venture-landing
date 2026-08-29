"use client";

import Link from "next/link";
import type { CatalogLesson } from "./learn-types";

const TIERS = [
  { key: "beginner", emoji: "🌱", label: "Beginner" },
  { key: "intermediate", emoji: "💪", label: "Intermediate" },
  { key: "advanced", emoji: "🧠", label: "Advanced" },
] as const;

type Props = {
  lessons: CatalogLesson[];
};

function lessonTime(seconds: number | null) {
  if (!seconds || seconds <= 0) return null;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export default function LearnClient({ lessons }: Props) {
  const totalLessons = lessons.length;
  const totalCompleted = lessons.filter((l) => l.completed).length;
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <div className="hub-page learn-page">
      <div className="learn-shell">
        <Link className="learn-back" href="/dashboard">
          {"←"} Hub
        </Link>
        <header className="learn-header">
          <h1 className="learn-title">Learn Wholesaling</h1>
          <p className="learn-sub">All 13 lessons, start to finish</p>
        </header>

        <div className="learn-stats-grid">
          <div className="learn-stat-card">
            <span className="learn-stat-icn">📚</span>
            <span className="learn-stat-num">{overallPct}%</span>
            <span className="learn-stat-lbl">Course complete</span>
          </div>
          <div className="learn-stat-card">
            <span className="learn-stat-icn">🎓</span>
            <span className="learn-stat-num">{totalCompleted}/{totalLessons}</span>
            <span className="learn-stat-lbl">Lessons completed</span>
          </div>
        </div>

        {TIERS.map((tier) => {
          const tierLessons = lessons.filter((l) => l.difficulty === tier.key);
          if (tierLessons.length === 0) return null;
          return (
            <section className="learn-section" key={tier.key}>
              <div className="learn-section-head">
                <span className="learn-section-emoji">{tier.emoji}</span>
                {tier.label}
              </div>
              <div className="learn-lesson-list">
                {tierLessons.map((lesson, index) => {
                  const rowClass = `learn-lesson-row${lesson.completed ? " complete" : ""}${lesson.locked ? " locked" : ""}`;
                  const time = lessonTime(lesson.durationSeconds);
                  const inner = (
                    <>
                      <span className="learn-lesson-num">{lesson.completed ? "✓" : lesson.number}</span>
                      <span className="learn-lesson-body">
                        <span className="learn-lesson-title">
                          {lesson.title}
                          {lesson.requiresPro && <span className="learn-pro-badge">PRO</span>}
                        </span>
                        {lesson.description && (
                          <span className="learn-lesson-desc">{lesson.description}</span>
                        )}
                        {time && <span className="learn-lesson-meta">{time}</span>}
                      </span>
                      <span className="learn-lesson-arw">{lesson.locked ? "🔒" : "→"}</span>
                    </>
                  );
                  return lesson.locked ? (
                    <button
                      type="button"
                      className={rowClass}
                      key={lesson.id}
                      style={{ "--i": String(index) } as React.CSSProperties}
                    >
                      {inner}
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/learn/${lesson.courseSlug}/${lesson.slug}`}
                      className={rowClass}
                      key={lesson.id}
                      style={{ "--i": String(index) } as React.CSSProperties}
                    >
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
