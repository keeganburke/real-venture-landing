-- 013: persist onboarding intake answers on member_profiles.
-- Until now answers lived only in the signed rv_intake cookie, which has a
-- 7-day TTL and cannot be queried. The cookie stays the gating source of
-- truth (dashboard/layout.tsx reads completedAt from it); these columns are
-- the durable, queryable copy written when onboarding completes.

alter table public.member_profiles
  add column if not exists intake_dream text,
  add column if not exists intake_hours text,
  add column if not exists intake_tried text[],
  add column if not exists intake_tried_failure text,
  add column if not exists intake_worry text,
  add column if not exists intake_worry_other text,
  add column if not exists intake_identity text,
  add column if not exists intake_invest text,
  add column if not exists intake_seriousness integer,
  add column if not exists intake_completed_at timestamptz;

comment on column public.member_profiles.intake_dream is 'Q1 free text: what would $5K change';
comment on column public.member_profiles.intake_hours is 'Q2 single-choice: hours/week';
comment on column public.member_profiles.intake_tried is 'Q3a multi-select: past attempts';
comment on column public.member_profiles.intake_tried_failure is 'Q3b free text: what went wrong';
comment on column public.member_profiles.intake_worry is 'Q4 single-choice: biggest fear';
comment on column public.member_profiles.intake_worry_other is 'Q4 free text if worry=other';
comment on column public.member_profiles.intake_identity is 'Q5 single-choice: life situation';
comment on column public.member_profiles.intake_invest is 'Q6 single-choice: Pro upsell readiness';
comment on column public.member_profiles.intake_seriousness is 'Q7 1-10 temp check';
comment on column public.member_profiles.intake_completed_at is 'When onboarding finished';
