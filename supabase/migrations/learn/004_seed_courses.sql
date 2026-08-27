-- Learn system: seed courses. Requires learn/001_courses.sql.
-- Idempotent: re-running skips rows whose slug already exists.

INSERT INTO courses (slug, title, description, category, tier, sort_order, is_published) VALUES
  ('wholesaling-101', 'Wholesaling 101', 'The complete beginner path. Zero to first deal in 14 days.', 'beginner', 'base', 1, true),
  ('buyers-first', 'Buyers First', 'Why finding buyers before deals is the real cheat code.', 'beginner', 'base', 2, true),
  ('deal-analysis-mastery', 'Deal Analysis Mastery', 'Pull comps, calculate ARV, and set your max offer like a pro.', 'intermediate', 'base', 1, true),
  ('seller-scripts', 'Seller Scripts That Close', 'The exact phrasing that gets sellers to say yes.', 'intermediate', 'base', 2, true),
  ('creative-finance', 'Creative Finance', 'Seller financing, subject-to, and multi-deal strategies.', 'advanced', 'pro', 1, true),
  ('llc-and-bank-setup', 'LLC & Bank Setup', 'Get your business entity and banking dialed in.', 'bonus', 'base', 1, true)
ON CONFLICT (slug) DO NOTHING;
