-- 018: cache Whop plan and tier on member_profiles
-- Sourced from Whop membership.plan.id during backfill or checkout.
-- Enables admin dashboard tier display without depending on
-- discord_connections (which only exists once member links Discord).
alter table public.member_profiles
  add column if not exists whop_plan_id text,
  add column if not exists whop_tier text;

comment on column public.member_profiles.whop_plan_id is
  'Whop plan_id (e.g. plan_J8vFpCWME75W3). Backfilled from Whop API.';
comment on column public.member_profiles.whop_tier is
  'Human-readable tier derived from whop_plan_id (Base / Pro / Ultra / etc). Backfilled during script runs.';
