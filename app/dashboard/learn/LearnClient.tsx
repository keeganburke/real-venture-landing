"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogLesson } from "./learn-types";
import UpgradeModal from "./UpgradeModal";

// Lesson emojis keyed by DB slug. Three slugs corrected from the spec list
// to the real DB values (same lessons, same order, same emojis).
const LESSON_EMOJI: Record<string, string> = {
  "orientation-and-expectations": "🧭",
  "what-wholesaling-actually-is": "🎯",
  "traditional-vs-secured-wholesaling": "⚖️",
  "how-to-find-a-buyer": "💎",
  "on-market-strategy": "🏡",
  "off-market-strategy": "🔍",
  "deal-analysis-and-underwriting": "📊",
  "acquisitions-and-getting-the-contract": "🔒",
  "how-to-fill-out-and-sign-the-contract": "📝",
  "dispositions-and-selling-the-contract": "🤝",
  "title-work-and-getting-paid": "💵",
  "reinvesting-and-scaling": "🚀",
  "case-studies": "🏆",
  "seller-financing": "🏦",
};

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
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // /dashboard/learn?upgrade=1 (server-side Pro gate redirect) opens the
  // modal on load, then cleans the URL so refresh does not re-trigger it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "1") {
      setUpgradeOpen(true);
      params.delete("upgrade");
      const rest = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? "?" + rest : ""));
    }
  }, []);

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
                      <span className="learn-lesson-num" style={{ fontSize: 15 }}>
                        {lesson.completed ? "✓" : LESSON_EMOJI[lesson.slug] ?? lesson.number}
                      </span>
                      <span className="learn-lesson-body">
                        <span className="learn-lesson-title">
                          {lesson.title}
                          {lesson.proGated ? (
                            <span className="learn-pro-badge">🔒 PRO</span>
                          ) : (
                            lesson.requiresPro && <span className="learn-pro-badge">PRO</span>
                          )}
                        </span>
                        {lesson.description && (
                          <span className="learn-lesson-desc">{lesson.description}</span>
                        )}
                        {time && <span className="learn-lesson-meta">{time}</span>}
                      </span>
                      <span className="learn-lesson-arw">{lesson.locked || lesson.proGated ? "🔒" : "→"}</span>
                    </>
                  );
                  return lesson.proGated ? (
                    <button
                      type="button"
                      className={`${rowClass} pro-gated`}
                      key={lesson.id}
                      onClick={() => setUpgradeOpen(true)}
                      style={{ "--i": String(index) } as React.CSSProperties}
                    >
                      {inner}
                    </button>
                  ) : lesson.locked ? (
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

        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </div>
    </div>
  );
}
