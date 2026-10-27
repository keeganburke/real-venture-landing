-- 026: payment-recovery drip (hourly cron, lib/payment-recovery.ts).
-- One row per past_due membership the drip has acted on, plus one row per
-- (membership, failed_at, day, channel) send so a day is never sent twice
-- within one failure sequence. A newer failed renewal resets the
-- payment_recovery row and starts a fresh set of sends keyed by that failed_at.
-- Service-role only, same pattern as 024 (RLS on, no policies).

create table if not exists public.payment_recovery (
  membership_id  text primary key,
  whop_user_id   text not null,
  plan_id        text,
  failed_at      timestamptz not null,
  started_at     timestamptz not null default now(),
  last_day_sent  int not null default 0,
  stopped_at     timestamptz,
  stop_reason    text
);
alter table public.payment_recovery enable row level security;
comment on table public.payment_recovery is
  'Payment-recovery drip state per membership, for the failure in failed_at. stopped_at set = that sequence is over (paid, canceled, window expired). A newer failed renewal resets the row.';

create table if not exists public.payment_recovery_sends (
  id             bigserial primary key,
  membership_id  text not null,
  failed_at      timestamptz not null,
  day            int not null check (day between 1 and 5),
  channel        text not null check (channel in ('ghl', 'discord_dm')),
  status         text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at        timestamptz not null default now(),
  unique (membership_id, failed_at, day, channel)
);
alter table public.payment_recovery_sends enable row level security;
comment on table public.payment_recovery_sends is
  'One row per (membership, failed_at, drip day, channel). The unique constraint is the dedupe: a second run that tries the same day of the same failure sequence gets 23505 and sends nothing.';
-- No policies on purpose: only the service role reads or writes these tables.
