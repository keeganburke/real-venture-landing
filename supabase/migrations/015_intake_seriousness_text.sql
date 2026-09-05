-- 015: change intake_seriousness from integer to text
-- Migration 013 wrote INTEGER when Q7 was a 1-10 scale.
-- Q7 later became a 4-choice single: curious | interested | committed | all_in.
-- Every intake upsert has been silently failing on this type mismatch since deploy.
-- Safe: column currently holds no data (all writes rejected), so USING cast has no rows.
alter table public.member_profiles
  alter column intake_seriousness type text
  using intake_seriousness::text;

comment on column public.member_profiles.intake_seriousness is
  'Q7 single-choice: curious | interested | committed | all_in';
