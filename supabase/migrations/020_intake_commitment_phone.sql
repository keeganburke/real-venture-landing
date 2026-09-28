-- 020: capture commitment level + phone in intake
alter table public.member_profiles
  add column if not exists whop_commitment_min integer,
  add column if not exists whop_phone text;

comment on column public.member_profiles.whop_commitment_min is
  'Minutes per day the member committed to during intake. Drives daily goal display.';
comment on column public.member_profiles.whop_phone is
  'Phone number for SMS accountability. Opt-in during intake.';
