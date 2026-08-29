import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { createAdminClient } from "../../../lib/supabase/server";
import LearnClient from "./LearnClient";
import { DIFFICULTY_BY_COURSE_SLUG, type CatalogLesson, type Course } from "./learn-types";
import { getWhopMemberSummary } from "../../../lib/whop-member";

export const metadata: Metadata = {
  title: "Real Venture | Learn",
};

// Auth is enforced by app/dashboard/layout.tsx; this page only needs the user
// id for progress. The service-role client never leaves the server.
export const dynamic = "force-dynamic";

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  sort_order: number;
  requires_pro: boolean;
};

export default async function LearnPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const userId = session?.whopUserId ?? "";

  const supabase = createAdminClient();
  const [coursesRes, lessonsRes, progressRes, whopMember] = await Promise.all([
    supabase
      .from("courses")
      .select("id,slug,title,description,category,tier,thumbnail_url,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("lessons")
      .select("id,course_id,slug,title,description,duration_seconds,sort_order,requires_pro")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_lesson_progress")
      .select("lesson_id,completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    getWhopMemberSummary(userId),
  ]);

  const courses = (coursesRes.data ?? []) as Course[];
  const lessonRows = (lessonsRes.data ?? []) as LessonRow[];
  const completedLessonIds = new Set((progressRes.data ?? []).map((row) => row.lesson_id));

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const courseOrder = new Map(courses.map((c) => [c.id, c.sort_order]));

  // Flat sequence in curriculum order: course order, then lesson order.
  // Mirrors the sequential gate the lesson player enforces server-side.
  const ordered = [...lessonRows].sort(
    (a, b) =>
      (courseOrder.get(a.course_id) ?? 0) - (courseOrder.get(b.course_id) ?? 0) ||
      a.sort_order - b.sort_order
  );

  let maxCompletedIndex = -1;
  ordered.forEach((lesson, index) => {
    if (completedLessonIds.has(lesson.id)) maxCompletedIndex = Math.max(maxCompletedIndex, index);
  });
  const maxUnlockedIndex = maxCompletedIndex + 1;

  // Unknown tier gates like Base: safer to over-lock than leak Pro content.
  const isPro = whopMember.tier === "Pro";

  const lessons: CatalogLesson[] = ordered.map((lesson, index) => {
    const course = courseById.get(lesson.course_id);
    const fallback =
      course?.category === "advanced"
        ? "advanced"
        : course?.category === "beginner"
          ? "beginner"
          : "intermediate";
    const difficulty = (course && DIFFICULTY_BY_COURSE_SLUG[course.slug]) ?? fallback;
    const completed = completedLessonIds.has(lesson.id);
    const proGated = difficulty === "advanced" && !isPro;
    const proLocked = lesson.requires_pro && !isPro;
    const sequenceLocked = !completed && index > maxUnlockedIndex;
    return {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description,
      courseSlug: course?.slug ?? "",
      difficulty,
      durationSeconds: lesson.duration_seconds,
      number: index + 1,
      completed,
      locked: proLocked || sequenceLocked,
      requiresPro: lesson.requires_pro,
      proGated,
    };
  });

  return <LearnClient lessons={lessons} />;
}
