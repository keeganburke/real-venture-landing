-- Learn system: course catalog.
-- Run order: learn/001 -> 002 -> 003 -> 004 -> 005 (each depends on the prior).

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('beginner', 'intermediate', 'advanced', 'bonus')),
  tier text NOT NULL DEFAULT 'base' CHECK (tier IN ('base', 'pro', 'ultra')),
  thumbnail_url text,
  sort_order numeric NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_category_sort ON courses (category, sort_order);

-- RLS: catalog is readable; writes are admin-only (Supabase dashboard or the
-- service-role client, which bypasses RLS). Note this app currently reads via
-- the service-role client in API routes only; the anon read policy is for
-- future direct reads and mirrors the spec.
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY courses_public_read ON courses
  FOR SELECT
  USING (true);
