import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { createAdminClient } from "../../../lib/supabase/server";
import LearnClient from "./LearnClient";
import type { Course } from "./learn-types";

export const metadata: Metadata = {
  title: "Real Venture | Learn",
};

// Auth is enforced by app/dashboard/layout.tsx; this page only needs the user
// id for progress. The service-role client never leaves the server.
export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const userId = session?.whopUserId ?? "";

  const supabase = createAdminClient();
  const [coursesRes, lessonsRes, progressRes] = await Promise.all([
    supabase
      .from("courses")
      .select("id,slug,title,description,category,tier,thumbnail_url,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("lessons")
      .select("id,course_id")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_lesson_progress")
      .select("lesson_id,completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);

  const courses = (coursesRes.data ?? []) as Course[];
  const lessons = lessonsRes.data ?? [];
  const completedLessonIds = new Set((progressRes.data ?? []).map((row) => row.lesson_id));

  const lessonCounts: Record<string, number> = {};
  const completedCounts: Record<string, number> = {};
  for (const lesson of lessons) {
    lessonCounts[lesson.course_id] = (lessonCounts[lesson.course_id] ?? 0) + 1;
    if (completedLessonIds.has(lesson.id)) {
      completedCounts[lesson.course_id] = (completedCounts[lesson.course_id] ?? 0) + 1;
    }
  }

  return (
    <LearnClient courses={courses} lessonCounts={lessonCounts} completedCounts={completedCounts} />
  );
}
