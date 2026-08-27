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
