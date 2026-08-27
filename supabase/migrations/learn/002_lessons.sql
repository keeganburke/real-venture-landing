-- Learn system: lessons. Requires learn/001_courses.sql.
--
-- content JSONB is an ordered array of blocks:
-- [
--   { "type": "video", "youtube_id": "abc123", "title": "Intro (optional)" },
--   { "type": "text", "body": "Markdown body here..." },
--   { "type": "quiz", "question": "What is ARV?",
--     "options": ["After Repair Value", "Actual Rental Value", "Average Rental Volume"],
--     "correct": 0, "explanation": "ARV = After Repair Value..." },
--   { "type": "action", "label": "Try the Deal Analyzer", "href": "https://realventurestudio.com/analyzer" }
-- ]

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds int,
  sort_order numeric NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  requires_pro boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE INDEX idx_lessons_course_sort ON lessons (course_id, sort_order);

-- RLS: lessons are readable in the catalog; pro/tier gating happens in the app
-- layer (requires_pro + the user's Whop tier), not here. Writes are admin-only.
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY lessons_public_read ON lessons
  FOR SELECT
  USING (true);
