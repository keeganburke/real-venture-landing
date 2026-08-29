import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../../lib/session";
import { createAdminClient } from "../../../../../lib/supabase/server";
import LessonClient from "./LessonClient";
import { DIFFICULTY_BY_COURSE_SLUG, type Course, type Lesson } from "../../learn-types";
import { getWhopMemberSummary } from "../../../../../lib/whop-member";

export const metadata: Metadata = {
  title: "Real Venture | Lesson",
};

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const userId = session?.whopUserId ?? "";

  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id,slug,title,description,category,tier,thumbnail_url,sort_order")
    .eq("slug", courseSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!course) notFound();

  // Advanced lessons are Pro-only. Unknown tier gates like Base; the catalog
  // opens the upgrade modal via the query param.
  if (DIFFICULTY_BY_COURSE_SLUG[course.slug] === "advanced") {
    const whopMember = await getWhopMemberSummary(userId);
    if (whopMember.tier !== "Pro") redirect("/dashboard/learn?upgrade=1");
  }

  const [lessonsRes, progressRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("id,course_id,slug,title,description,content,duration_seconds,sort_order,requires_pro")
      .eq("course_id", course.id)
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_lesson_progress")
      .select("lesson_id,completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);

  const lessons = (lessonsRes.data ?? []) as Lesson[];
  const currentIndex = lessons.findIndex((l) => l.slug === lessonSlug);
  if (currentIndex === -1) notFound();

  const currentLesson = lessons[currentIndex];

  const lessonIds = new Set(lessons.map((l) => l.id));
  const completedLessonIds = new Set(
    (progressRes.data ?? [])
      .map((row) => row.lesson_id as string)
      .filter((id) => lessonIds.has(id)),
  );

  // Sequential gate: mirror CourseClient exactly. Highest completed + 1 unlocks.
  let highestCompletedIndex = -1;
  lessons.forEach((lesson, index) => {
    if (completedLessonIds.has(lesson.id)) highestCompletedIndex = index;
  });
  const maxUnlockedIndex = highestCompletedIndex + 1;

  // Hardcoded "base" tier for now; Whop tier detection is a future pass.
  const userTier = "base" as const;
  const proLocked = currentLesson.requires_pro && userTier === "base";
  const sequenceLocked =
    !completedLessonIds.has(currentLesson.id) && currentIndex > maxUnlockedIndex;

  if (proLocked || sequenceLocked) {
    redirect(`/dashboard/learn/${courseSlug}`);
  }

  // Compute "next lesson" href: next in this course, or first of next course, or null.
  let nextLessonHref: string | null = null;
  let isLastLessonOfCourse = false;
  let isLastLessonOverall = false;

  if (currentIndex < lessons.length - 1) {
    const next = lessons[currentIndex + 1];
    nextLessonHref = `/dashboard/learn/${course.slug}/${next.slug}`;
  } else {
    isLastLessonOfCourse = true;
    // Find next course by sort_order + first published lesson
    const { data: allCourses } = await supabase
      .from("courses")
      .select("id,slug,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    const idx = (allCourses ?? []).findIndex((c) => c.id === course.id);
    const nextCourse = idx >= 0 && idx < (allCourses?.length ?? 0) - 1 ? allCourses![idx + 1] : null;
    if (nextCourse) {
      const { data: nextLessons } = await supabase
        .from("lessons")
        .select("slug")
        .eq("course_id", nextCourse.id)
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .limit(1);
      if (nextLessons && nextLessons.length > 0) {
        nextLessonHref = `/dashboard/learn/${nextCourse.slug}/${nextLessons[0].slug}`;
      } else {
        isLastLessonOverall = true;
      }
    } else {
      isLastLessonOverall = true;
    }
  }

  return (
    <LessonClient
      course={course as Course}
      lessons={lessons}
      currentLesson={currentLesson}
      currentIndex={currentIndex}
      completedLessonIds={Array.from(completedLessonIds)}
      nextLessonHref={nextLessonHref}
      isLastLessonOfCourse={isLastLessonOfCourse}
      isLastLessonOverall={isLastLessonOverall}
    />
  );
}
