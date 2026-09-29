import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../lib/session";
import { createAdminClient } from "../../lib/supabase/server";
import { getWhopMemberSummary, resolveDisplayName } from "../../lib/whop-member";
import HubClient from "./HubClient";
import { DESTINATIONS, FEEDBACK } from "./hub-copy";

export const metadata: Metadata = {
  title: "Real Venture | Hub",
};

export const dynamic = "force-dynamic";

type LessonRow = {
  id: string;
  slug: string;
  title: string;
  duration_seconds: number | null;
  sort_order: number;
  course_id: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tour?: string }>;
}) {
  const { tour } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const userId = session?.whopUserId ?? "";

  // No name source exists yet (the intake cookie carries no name and there is
  // no Whop profile fetch). Filled from member_profiles below when the user
  // has saved a display name; null keeps the nameless greeting variants.
  let displayName: string | null = null;

  const supabase = createAdminClient();

  const [coursesRes, lessonsRes, progressRes, profileRes, whopMember] = await Promise.all([
    supabase
      .from("courses")
      .select("id,slug,title,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("lessons")
      .select("id,slug,title,duration_seconds,sort_order,course_id")
      .eq("is_published", true),
    supabase
      .from("user_lesson_progress")
      .select("lesson_id,completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabase
      .from("member_profiles")
      .select("display_name,spotlight_completed_at")
      .eq("whop_user_id", userId)
      .maybeSingle(),
    getWhopMemberSummary(userId),
  ]);

  // Saved profile wins; Whop's embedded user record fills the gaps so the
  // greeting and avatar work before anyone edits their profile.
  const profileName = profileRes.data?.display_name;
  if (typeof profileName === "string" && profileName.trim().length > 0) {
    displayName = profileName.trim();
  } else {
    displayName = resolveDisplayName(whopMember);
  }

  // ?tour=1 forces the tour open -- that is how onboarding hands off after the
  // last question, and it wins even for someone who already finished once.
  // Otherwise a null spotlight_completed_at (or no profile row) means unseen.
  const showTour = tour === "1" || !profileRes.data?.spotlight_completed_at;

  const courses = coursesRes.data ?? [];
  const lessons = (lessonsRes.data ?? []) as LessonRow[];
  const completedIds = new Set((progressRes.data ?? []).map((r) => r.lesson_id));

  // Build a flat sequence of lessons across all courses, ordered by
  // (course sort_order, lesson sort_order). This is the resume sequence.
  const courseOrder = new Map(courses.map((c) => [c.id, c.sort_order]));
  const courseSlug = new Map(courses.map((c) => [c.id, c.slug]));
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));

  const flatLessons = [...lessons].sort((a, b) => {
    const co = (courseOrder.get(a.course_id) ?? 0) - (courseOrder.get(b.course_id) ?? 0);
    if (co !== 0) return co;
    return a.sort_order - b.sort_order;
  });

  const totalLessons = flatLessons.length;
  const doneCount = flatLessons.filter((l) => completedIds.has(l.id)).length;

  // Next lesson = first uncompleted in flat sequence.
  const nextLesson = flatLessons.find((l) => !completedIds.has(l.id)) ?? null;

  const nextLessonInfo = nextLesson
    ? {
        title: nextLesson.title,
        courseTitle: courseTitle.get(nextLesson.course_id) ?? "",
        durationMin: nextLesson.duration_seconds
          ? Math.max(1, Math.round(nextLesson.duration_seconds / 60))
          : null,
        href: `/dashboard/learn/${courseSlug.get(nextLesson.course_id)}/${nextLesson.slug}`,
        sequenceIndex: flatLessons.findIndex((l) => l.id === nextLesson.id) + 1,
      }
    : null;

  return (
    <HubClient
      displayName={displayName}
      doneCount={doneCount}
      totalLessons={totalLessons}
      nextLesson={nextLessonInfo}
      destinations={DESTINATIONS}
      feedback={FEEDBACK}
      showTour={showTour}
    />
  );
}
