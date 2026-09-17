"use client";

import Link from "next/link";
import type { Course, Lesson } from "../learn-types";

type Props = {
  course: Course;
  lessons: Lesson[];
  completedLessonIds: string[];
  userTier: "base" | "pro" | "ultra";
};

function contentTypes(lesson: Lesson): string[] {
  const icons: string[] = [];
  const blocks = Array.isArray(lesson.content) ? lesson.content : [];
  if (blocks.some((block) => block.type === "video")) icons.push("🎥");
  if (blocks.some((block) => block.type === "text")) icons.push("📄");
  if (blocks.some((block) => block.type === "quiz")) icons.push("❓");
  return icons;
}

function lessonTime(lesson: Lesson): string | null {
  if (lesson.duration_seconds && lesson.duration_seconds > 0) {
    return `${Math.max(1, Math.round(lesson.duration_seconds / 60))} min`;
  }
  return null;
}

// userTier is still passed by the page for a future tier gate; it gates
// nothing today, so it is not destructured.
export default function CourseClient({ course, lessons, completedLessonIds }: Props) {
  const completed = new Set(completedLessonIds);

  // No sequence gate and no Pro gate: every lesson row is a plain link.
  // The lock toast ("Complete the previous lesson first") is gone with it.

  const doneCount = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const pct = lessons.length > 0 ? Math.round((doneCount / lessons.length) * 100) : 0;

  return (
    <div className="hub-page learn-page">
      <div className="learn-shell">
        <Link className="learn-back" href="/dashboard/learn">
          {"←"} All courses
        </Link>

        <header className="learn-course-head">
          <h1 className="learn-title">
            {course.title}
            {course.tier === "pro" && <span className="learn-pro-badge">PRO</span>}
          </h1>
          {course.description && <p className="learn-sub">{course.description}</p>}
          <div className="learn-detail-progress">
            <span className="learn-detail-count">
              {doneCount} of {lessons.length} lessons complete
            </span>
            <span className="learn-course-bar">
              <span
                className={`learn-course-fill${pct === 100 ? " done" : ""}`}
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        </header>

        <div className="learn-lesson-list">
          {lessons.map((lesson, index) => {
            const isComplete = completed.has(lesson.id);
            const proLocked = false;
            const sequenceLocked = false;
            const lockReason = proLocked || sequenceLocked ? "locked" : null;
            const rowClass = `learn-lesson-row${isComplete ? " complete" : ""}${lockReason ? " locked" : ""}`;
            const inner = (
              <>
                <span className="learn-lesson-num">{isComplete ? "✓" : index + 1}</span>
                <span className="learn-lesson-body">
                  <span className="learn-lesson-title">
                    {lesson.title}
                    {lesson.requires_pro && <span className="learn-pro-badge">PRO</span>}
                  </span>
                  {lesson.description && (
                    <span className="learn-lesson-desc">{lesson.description}</span>
                  )}
                  <span className="learn-lesson-meta">
                    <span className="learn-lesson-types">{contentTypes(lesson).join(" ")}</span>
                    {lessonTime(lesson)}
                  </span>
                </span>
                <span className="learn-lesson-arw">{lockReason ? "🔒" : "→"}</span>
              </>
            );
            return (
              <Link
                href={`/dashboard/learn/${course.slug}/${lesson.slug}`}
                className={rowClass}
                key={lesson.id}
                style={{ "--i": String(index) } as React.CSSProperties}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
