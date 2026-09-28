-- 022_intake_age_open_seriousness_followup.sql
--
-- Removes the age range check (Keegan does not want a floor or ceiling).
-- Adds intake_seriousness_followup for Q6 branching:
--   9-10  -> "first deal size target" free text
--   5-8   -> "what would push you to a 10?" free text
--   1-4   -> "what's making you feel that way?" free text
-- One column, branch derived from intake_seriousness_scale.

alter table public.member_profiles
  drop constraint if exists member_profiles_age_range;

alter table public.member_profiles
  add column if not exists intake_seriousness_followup text;
