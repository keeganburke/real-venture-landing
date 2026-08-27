import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";
import CourseClient from "./CourseClient";
import type { Course, Lesson } from "../learn-types";

export const metadata: Metadata = {
  title: "Real Venture | Course",
};

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;

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
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const completedLessonIds = (progressRes.data ?? [])
    .map((row) => row.lesson_id as string)
    .filter((id) => lessonIds.has(id));

  // Whop tier detection is a future pass; everyone reads as base for now.
  const userTier = "base" as const;

  return (
    <CourseClient
      course={course as Course}
      lessons={lessons}
      completedLessonIds={completedLessonIds}
      userTier={userTier}
    />
  );
}
