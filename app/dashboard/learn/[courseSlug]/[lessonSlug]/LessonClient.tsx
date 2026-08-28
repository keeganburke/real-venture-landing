"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Course, Lesson } from "../../learn-types";

type ContentBlock =
  | { type: "video"; youtube_id: string }
  | { type: "text"; body: string }
  | { type: "quiz"; id?: string; question: string; options: string[]; correct: number; explanation?: string }
  | { type: "action"; label: string; href: string };

type Props = {
  course: Course;
  lessons: Lesson[];
  currentLesson: Lesson;
  currentIndex: number;
  completedLessonIds: string[];
};

export default function LessonClient({
  course,
  lessons,
  currentLesson,
  currentIndex,
  completedLessonIds,
}: Props) {
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);

  const maxUnlockedIndex = useMemo(() => {
    let highest = -1;
    lessons.forEach((l, i) => {
      if (completedSet.has(l.id)) highest = i;
    });
    return highest + 1;
  }, [lessons, completedSet]);

  const blocks = (currentLesson.content as unknown as ContentBlock[]) ?? [];

  return (
    <div className="lesson-page">
      <header className="lesson-topbar">
        <Link href={`/dashboard/learn/${course.slug}`} className="lesson-back">
          <span aria-hidden="true">←</span>
          <span>{course.title}</span>
        </Link>
        <span className="lesson-counter">
          Lesson {currentIndex + 1} of {lessons.length}
        </span>
      </header>

      <div className="lesson-shell">
        <aside className="lesson-sidebar">
          <div className="lesson-sidebar-title">Lessons</div>
          <ol className="lesson-list">
            {lessons.map((lesson, i) => {
              const isComplete = completedSet.has(lesson.id);
              const isCurrent = lesson.id === currentLesson.id;
              const isLocked = !isComplete && i > maxUnlockedIndex;
              const num = String(i + 1).padStart(2, "0");

              const inner = (
                <>
                  <span className="lesson-list-num" aria-hidden="true">
                    {isComplete ? "✓" : isLocked ? "🔒" : num}
                  </span>
                  <span className="lesson-list-title">{lesson.title}</span>
                </>
              );

              const rowClass =
                "lesson-list-row" +
                (isCurrent ? " is-current" : "") +
                (isComplete ? " is-complete" : "") +
                (isLocked ? " is-locked" : "");

              return (
                <li key={lesson.id} className={rowClass} style={{ "--i": String(i) } as React.CSSProperties}>
                  {isLocked ? (
                    <div className="lesson-list-inner" aria-disabled="true">
                      {inner}
                    </div>
                  ) : (
                    <Link
                      href={`/dashboard/learn/${course.slug}/${lesson.slug}`}
                      className="lesson-list-inner"
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="lesson-main">
          <h1 className="lesson-title">{currentLesson.title}</h1>
          {currentLesson.description && (
            <p className="lesson-description">{currentLesson.description}</p>
          )}

          <div className="lesson-blocks">
            {blocks.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "video":
      return <VideoBlock youtubeId={block.youtube_id} />;
    case "text":
      return <TextBlock body={block.body} />;
    case "action":
      return <ActionBlock label={block.label} href={block.href} />;
    case "quiz":
      return (
        <QuizBlock
          question={block.question}
          options={block.options}
          correct={block.correct}
          explanation={block.explanation}
        />
      );
    default:
      return null;
  }
}

function VideoBlock({ youtubeId }: { youtubeId: string }) {
  if (!youtubeId || youtubeId === "PLACEHOLDER") {
    return <div className="lesson-video-placeholder">Video coming soon</div>;
  }
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0`;
  return (
    <div className="lesson-video">
      <iframe
        src={src}
        title="Lesson video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

function TextBlock({ body }: { body: string }) {
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  return (
    <div className="lesson-text">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function ActionBlock({ label, href }: { label: string; href: string }) {
  return (
    <div className="lesson-action">
      <a href={href} target="_blank" rel="noopener noreferrer" className="lesson-action-btn">
        <span>{label}</span>
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

function QuizBlock({
  question,
  options,
  correct,
  explanation,
}: {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const revealed = selected !== null;
  const isRight = selected === correct;

  return (
    <div className="lesson-quiz">
      <div className="lesson-quiz-question">{question}</div>
      <ol className="lesson-quiz-options">
        {options.map((opt, i) => {
          let cls = "lesson-quiz-option";
          if (revealed) {
            if (i === correct) cls += " is-correct";
            else if (i === selected) cls += " is-wrong";
          }
          return (
            <li key={i}>
              <button
                type="button"
                className={cls}
                onClick={() => setSelected(i)}
                disabled={revealed}
              >
                <span className="lesson-quiz-option-letter" aria-hidden="true">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="lesson-quiz-option-text">{opt}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {revealed && (
        <div className={`lesson-quiz-feedback${isRight ? " is-correct" : " is-wrong"}`}>
          <div className="lesson-quiz-verdict">{isRight ? "Correct" : "Not quite"}</div>
          {explanation && <div className="lesson-quiz-explanation">{explanation}</div>}
          {!isRight && (
            <button
              type="button"
              className="lesson-quiz-retry"
              onClick={() => setSelected(null)}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
