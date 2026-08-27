-- Learn system: per-user lesson progress. Requires learn/002_lessons.sql.
-- user_id is the Whop user id (text), matching cancel_flow_events.user_id.

CREATE TABLE user_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at timestamptz,
  watched_seconds int DEFAULT 0,
  quiz_answers jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX idx_user_lesson_progress_user ON user_lesson_progress (user_id);

-- RLS: own-rows-only policies below use Supabase Auth JWTs. NOTE: this app
-- does not use Supabase Auth today (identity is the Whop session cookie, and
-- all reads/writes go through the service-role client in API routes, which
-- bypasses RLS). These policies are inert until Supabase Auth is adopted, but
-- they make RLS explicit and future-proof; real per-user gating lives in the
-- API routes, which must verify the session on every mutating call.
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_lesson_progress_own_select ON user_lesson_progress
  FOR SELECT
  USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY user_lesson_progress_own_insert ON user_lesson_progress
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY user_lesson_progress_own_update ON user_lesson_progress
  FOR UPDATE
  USING (auth.jwt() ->> 'sub' = user_id)
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);
