-- 008_move_closing_to_beginner.sql
-- Move "Closing the Deal" from Intermediate to Beginner category.
-- Idempotent: safe to re-run.

UPDATE courses
SET category = 'beginner',
    updated_at = now()
WHERE slug = 'closing-the-deal';
