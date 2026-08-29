// Shared shapes for the Learn system (rows come from Supabase via the
// service-role client in server components; only published rows are fetched).

export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: "beginner" | "intermediate" | "advanced" | "bonus";
  tier: "base" | "pro" | "ultra";
  thumbnail_url: string | null;
  sort_order: number;
};

export type ContentBlock = {
  type: "video" | "text" | "quiz" | "action";
  [key: string]: unknown;
};

// The UI flattens the four DB courses into difficulty tiers. Keyed by course
// slug because the DB category values predate this grouping. Shared by the
// catalog page and the lesson page's server-side Pro gate.
export const DIFFICULTY_BY_COURSE_SLUG: Record<
  string,
  "beginner" | "intermediate" | "advanced"
> = {
  foundations: "beginner",
  "finding-deals-and-buyers": "intermediate",
  "closing-the-deal": "intermediate",
  scaling: "advanced",
};

// Flattened catalog row for the learn index: lessons grouped by difficulty
// tier instead of course; courseSlug is kept purely for the lesson href.
export type CatalogLesson = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  courseSlug: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  durationSeconds: number | null;
  number: number;
  completed: boolean;
  locked: boolean;
  requiresPro: boolean;
  // Advanced lesson viewed by a non-Pro member: visible, badged, opens the
  // upgrade modal instead of navigating.
  proGated: boolean;
};

export type Lesson = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  content: ContentBlock[];
  duration_seconds: number | null;
  sort_order: number;
  requires_pro: boolean;
};
