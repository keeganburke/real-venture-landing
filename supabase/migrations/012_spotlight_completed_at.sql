-- 012: track completion of the /dashboard spotlight guided tour.
-- Lives on member_profiles (this repo's profile table, keyed by the Whop user
-- id from the signed rv_session cookie). There is no `profiles` table here --
-- that one belongs to the Studio repo.

alter table public.member_profiles
  add column if not exists spotlight_completed_at timestamptz;

comment on column public.member_profiles.spotlight_completed_at is
  'When the guided tour was completed or skipped. Null = should show tour on next dashboard visit. Populated by /api/tour/complete route.';
