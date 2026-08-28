"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  nextLessonHref: string | null;
  isLastLessonOfCourse: boolean;
  isLastLessonOverall: boolean;
};

const PASS_THRESHOLD = 4; // out of 5

export default function LessonClient({
  course,
  lessons,
  currentLesson,
  currentIndex,
  completedLessonIds,
  nextLessonHref,
  isLastLessonOfCourse,
  isLastLessonOverall,
}: Props) {
  const router = useRouter();
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);

  const maxUnlockedIndex = useMemo(() => {
    let highest = -1;
    lessons.forEach((l, i) => {
      if (completedSet.has(l.id)) highest = i;
    });
    return highest + 1;
  }, [lessons, completedSet]);

  const blocks = (currentLesson.content as unknown as ContentBlock[]) ?? [];
  const nonQuizBlocks = blocks.filter((b) => b.type !== "quiz");
  const quizBlocks = blocks.filter((b): b is Extract<ContentBlock, { type: "quiz" }> => b.type === "quiz");

  // Quiz state machine: "gate" (button) | "quiz" (answering) | "fail" (score screen with wrong answers) | "pass" (complete card)
  const alreadyComplete = completedSet.has(currentLesson.id);
  const [stage, setStage] = useState<"gate" | "quiz" | "fail" | "pass">(
    alreadyComplete ? "pass" : "gate"
  );
  const [selections, setSelections] = useState<(number | null)[]>(() =>
    quizBlocks.map(() => null)
  );
  const [lastScore, setLastScore] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [postedComplete, setPostedComplete] = useState(alreadyComplete);

  // Reset stage + selections if the lesson changes (route navigation reusing this client)
  useEffect(() => {
    const complete = completedSet.has(currentLesson.id);
    setStage(complete ? "pass" : "gate");
    setSelections(quizBlocks.map(() => null));
    setLastScore(0);
    setPostedComplete(complete);
  }, [currentLesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allAnswered = selections.every((s) => s !== null);

  const handleStartQuiz = () => setStage("quiz");

  const handleSelect = (qIdx: number, optIdx: number) => {
    setSelections((prev) => {
      const next = [...prev];
      next[qIdx] = optIdx;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;
    const score = quizBlocks.reduce((acc, q, i) => acc + (selections[i] === q.correct ? 1 : 0), 0);
    setLastScore(score);
    if (score >= PASS_THRESHOLD) {
      setStage("pass");
      if (!postedComplete) {
        setSubmitting(true);
        try {
          await fetch("/api/learn/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId: currentLesson.id, action: "complete" }),
          });
          setPostedComplete(true);
          router.refresh();
        } catch {
          // Fail silently. The user still sees the pass state; the completion
          // retry happens naturally the next time this lesson mounts unposted.
        } finally {
          setSubmitting(false);
        }
      }
    } else {
      setStage("fail");
    }
  };

  const handleRetry = () => {
    setSelections(quizBlocks.map(() => null));
    setStage("quiz");
  };

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
            {nonQuizBlocks.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>

          {quizBlocks.length > 0 && (
            <div className="lesson-gate">
              {stage === "gate" && (
                <button
                  type="button"
                  className="lesson-gate-start"
                  onClick={handleStartQuiz}
                >
                  {"I've read the lesson — start the quiz"}
                </button>
              )}

              {stage === "quiz" && (
                <div className="lesson-gate-quiz">
                  <div className="lesson-gate-heading">Quiz</div>
                  <div className="lesson-gate-subheading">
                    Answer all {quizBlocks.length} questions. You need {PASS_THRESHOLD} out of {quizBlocks.length} to pass.
                  </div>
                  <div className="lesson-gate-questions">
                    {quizBlocks.map((q, qi) => (
                      <QuizQuestion
                        key={qi}
                        num={qi + 1}
                        question={q.question}
                        options={q.options}
                        selected={selections[qi]}
                        onSelect={(oi) => handleSelect(qi, oi)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="lesson-gate-submit"
                    onClick={handleSubmit}
                    disabled={!allAnswered || submitting}
                  >
                    {submitting ? "Submitting..." : "Submit quiz"}
                  </button>
                </div>
              )}

              {stage === "fail" && (
                <div className="lesson-gate-fail">
                  <div className="lesson-gate-fail-score">
                    You got {lastScore} out of {quizBlocks.length}.
                  </div>
                  <div className="lesson-gate-fail-sub">
                    You need {PASS_THRESHOLD} to pass. Review the ones you missed, then try again.
                  </div>
                  <div className="lesson-gate-fail-review">
                    {quizBlocks.map((q, qi) => {
                      const userAnswer = selections[qi];
                      const isWrong = userAnswer !== q.correct;
                      if (!isWrong) return null;
                      return (
                        <div key={qi} className="lesson-gate-review-item">
                          <div className="lesson-gate-review-q">
                            <span className="lesson-gate-review-num">Q{qi + 1}.</span>{" "}
                            {q.question}
                          </div>
                          <div className="lesson-gate-review-your">
                            Your answer: <span className="is-wrong">{q.options[userAnswer as number]}</span>
                          </div>
                          <div className="lesson-gate-review-correct">
                            Correct answer: <span className="is-correct">{q.options[q.correct]}</span>
                          </div>
                          {q.explanation && (
                            <div className="lesson-gate-review-explain">{q.explanation}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="lesson-gate-retry"
                    onClick={handleRetry}
                  >
                    Try again
                  </button>
                </div>
              )}

              {stage === "pass" && (
                <div className="lesson-gate-pass">
                  <div className="lesson-gate-pass-check" aria-hidden="true">✓</div>
                  <div className="lesson-gate-pass-title">Lesson complete</div>
                  {lastScore > 0 && (
                    <div className="lesson-gate-pass-score">
                      You got {lastScore} out of {quizBlocks.length}.
                    </div>
                  )}
                  {nextLessonHref ? (
                    <Link href={nextLessonHref} className="lesson-gate-pass-next">
                      {isLastLessonOfCourse && !isLastLessonOverall
                        ? "Continue to the next course →"
                        : "Continue to next lesson →"}
                    </Link>
                  ) : (
                    <Link href="/dashboard/learn" className="lesson-gate-pass-next">
                      {"You've completed the curriculum. Back to all lessons →"}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function QuizQuestion({
  num,
  question,
  options,
  selected,
  onSelect,
}: {
  num: number;
  question: string;
  options: string[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="lesson-gate-question">
      <div className="lesson-gate-question-text">
        <span className="lesson-gate-question-num">Q{num}.</span> {question}
      </div>
      <ol className="lesson-gate-options">
        {options.map((opt, i) => {
          const isSelected = selected === i;
          return (
            <li key={i}>
              <button
                type="button"
                className={`lesson-gate-option${isSelected ? " is-selected" : ""}`}
                onClick={() => onSelect(i)}
              >
                <span className="lesson-gate-option-letter" aria-hidden="true">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="lesson-gate-option-text">{opt}</span>
              </button>
            </li>
          );
        })}
      </ol>
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
