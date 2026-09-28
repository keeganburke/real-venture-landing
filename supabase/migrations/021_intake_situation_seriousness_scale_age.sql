-- 021_intake_situation_seriousness_scale_age.sql
--
-- Adds three columns to member_profiles for the new 8-question intake:
--   intake_situation         Q5 "What's your situation right now?" (working full time / part time / not working / in school)
--   intake_seriousness_scale Q6 1-10 tap scale (integer, replaces the old text intake_seriousness field)
--   intake_age               Q7 open-text number (stored as integer)
--
-- We intentionally do NOT touch intake_hours, intake_invest, intake_identity,
-- or the text intake_seriousness column. Old rows keep their data; the new
-- flow just stops writing to those columns.

alter table public.member_profiles
  add column if not exists intake_situation text,
  add column if not exists intake_seriousness_scale integer,
  add column if not exists intake_age integer;

-- Sanity check constraints (loose, matches app-level validation)
alter table public.member_profiles
  add constraint member_profiles_seriousness_scale_range
    check (intake_seriousness_scale is null
           or (intake_seriousness_scale >= 1 and intake_seriousness_scale <= 10));

alter table public.member_profiles
  add constraint member_profiles_age_range
    check (intake_age is null
           or (intake_age >= 13 and intake_age <= 120));
