-- 033: payment-recovery Discord post dedupe (lib/payment-recovery-post.ts,
-- app/api/cron/payment-recovery).
--   payment_recovery_posts  one row per (kind, Chicago calendar day) post the
--                           hourly cron has made. The morning digest
--                           (kind morning_digest) is posted by the first run
--                           at or after 9:00 America/Chicago: the run inserts
--                           its row first and only posts when the insert
--                           succeeded, so two runs never both post. Until this
--                           table exists the digest is skipped and the route
--                           JSON says why (digest.reason).
-- 026, 027, 030, 031 and 032 are applied. Service-role only, RLS on, no policies (same pattern).

create table if not exists public.payment_recovery_posts (
  kind         text not null,
  chicago_date date not null,
  posted_at    timestamptz not null default now(),
  primary key (kind, chicago_date)
);
alter table public.payment_recovery_posts enable row level security;
comment on table public.payment_recovery_posts is
  'Dedupe for once-a-day payment-recovery Discord posts: one row per (kind, America/Chicago date). morning_digest = the Morning recovery report.';
-- No policies on purpose: only the service role reads or writes this table.
