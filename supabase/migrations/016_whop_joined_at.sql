-- 016: track when member joined via Whop
-- Sourced from Whop membership.joined_at during backfill.
-- member_profiles.created_at reflects when the row was first upserted
-- into our DB, which is misleading (backfill = all "joined today").
-- This column is the real join date and drives admin sorting.
alter table public.member_profiles
  add column if not exists whop_joined_at timestamptz;

comment on column public.member_profiles.whop_joined_at is
  'When the member joined Real Venture on Whop (from Whop membership.joined_at). Backfilled from Whop API; kept in sync by backfill script re-runs.';
