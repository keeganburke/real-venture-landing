-- 031: payment-recovery results (lib/payment-recovery.ts, lib/payment-recovery-stats.ts,
-- app/r/[token]/route.ts, /dashboard/admin/recovery, Monday weekly mod post).
-- Adds click tracking and stop outcomes so the drip's results can be measured.
--   payment_recovery.whop_username   Whop username at first sight (for the results table).
--   payment_recovery.outcome         why the sequence stopped: paid, canceled, expired
--                                    (Whop expired it or day 14 passed still past_due), other.
--                                    stop_reason keeps the raw reason (status:<whop status>
--                                    or window_expired). Null while the sequence is open.
--   payment_recovery.paid_at         when the failed renewal was paid (Whop payment's
--                                    last_payment_attempt_at), with paid_amount, paid_currency
--                                    and paid_payment_id from the same payment. Null unless paid.
--   payment_recovery_links           one random token per (membership, failure, message number,
--                                    channel). {link} in every live message is
--                                    https://realventure.io/r/<token>; the route logs the click
--                                    and redirects to target_url (the member's Whop manage_url).
--                                    The membership id never appears in a URL.
--   payment_recovery_clicks          one row per click (time, channel, message number).
-- 026, 027 and 030 are applied. Service-role only, RLS on, no policies (same pattern).

alter table public.payment_recovery
  add column if not exists whop_username text,
  add column if not exists outcome text,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_amount numeric(12, 2),
  add column if not exists paid_currency text,
  add column if not exists paid_payment_id text;
alter table public.payment_recovery
  drop constraint if exists payment_recovery_outcome_check;
alter table public.payment_recovery
  add constraint payment_recovery_outcome_check
  check (outcome is null or outcome in ('paid', 'canceled', 'expired', 'other'));
comment on column public.payment_recovery.whop_username is 'Whop username when the drip first saw this failure sequence.';
comment on column public.payment_recovery.outcome is 'Why the sequence stopped: paid, canceled, expired, other. Null while open. stop_reason has the raw Whop status.';
comment on column public.payment_recovery.paid_at is 'When the failed renewal was paid (Whop payment last_payment_attempt_at). Null unless outcome is paid.';
comment on column public.payment_recovery.paid_amount is 'Amount of the paid renewal (Whop payment total.amount), in paid_currency.';
comment on column public.payment_recovery.paid_payment_id is 'Whop payment id of the paid renewal.';

create table if not exists public.payment_recovery_links (
  token            text primary key,
  membership_id    text not null,
  failed_at        timestamptz not null,
  message_number   int not null,
  channel          text not null check (channel in ('ghl', 'ghl_sms', 'discord_dm')),
  target_url       text not null,
  created_at       timestamptz not null default now(),
  click_count      int not null default 0,
  first_clicked_at timestamptz,
  last_clicked_at  timestamptz
);
create index if not exists payment_recovery_links_sequence_idx
  on public.payment_recovery_links (membership_id, failed_at);
alter table public.payment_recovery_links enable row level security;
comment on table public.payment_recovery_links is
  'Tracked {link} per (membership, failed_at, message_number, channel). realventure.io/r/<token> logs a click and redirects to target_url. channel: ghl = email, ghl_sms = SMS, discord_dm = bot DM.';

create table if not exists public.payment_recovery_clicks (
  id             bigserial primary key,
  token          text not null references public.payment_recovery_links (token),
  clicked_at     timestamptz not null default now(),
  channel        text not null,
  message_number int not null
);
create index if not exists payment_recovery_clicks_clicked_at_idx
  on public.payment_recovery_clicks (clicked_at);
alter table public.payment_recovery_clicks enable row level security;
comment on table public.payment_recovery_clicks is
  'One row per click on a tracked payment-recovery link: when, which channel, which message number.';
-- No policies on purpose: only the service role reads or writes these tables.
