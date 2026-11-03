-- 032: payment-recovery Discord DM reply capture (lib/payment-recovery-replies.ts,
-- app/api/cron/payment-recovery, /dashboard/admin/recovery).
--   payment_recovery_dm_channels  one row per member the drip has DMed: the bot's
--                                 DM channel with them (from POST /users/@me/channels)
--                                 and the last message id already looked at, so each
--                                 hourly run only reads what is new
--                                 (GET /channels/{id}/messages?after=<last_seen>).
--                                 Existing members (DMed before this migration) are
--                                 backfilled by the cron: it opens their channel and
--                                 starts last_seen at the moment of their first drip DM.
--   payment_recovery_replies      one row per member message found in such a channel
--                                 (never the bot's own). channel is the drip channel the
--                                 reply came in on; only discord_dm for now (email and
--                                 SMS replies live in GHL). discord_message_id is unique
--                                 so a re-read never records a reply twice.
-- 026, 027, 030 and 031 are applied. Service-role only, RLS on, no policies (same pattern).

create table if not exists public.payment_recovery_dm_channels (
  discord_user_id      text primary key,
  channel_id           text not null,
  whop_user_id         text,
  last_seen_message_id text,
  updated_at           timestamptz not null default now()
);
alter table public.payment_recovery_dm_channels enable row level security;
comment on table public.payment_recovery_dm_channels is
  'Bot DM channel per Discord user the payment-recovery drip has messaged. last_seen_message_id = newest message id already read; the cron polls GET /channels/{channel_id}/messages?after=<it>.';

create table if not exists public.payment_recovery_replies (
  id                 bigserial primary key,
  membership_id      text not null,
  channel            text not null check (channel in ('discord_dm')),
  text               text not null,
  received_at        timestamptz not null,
  discord_user_id    text,
  discord_message_id text unique,
  message_number     int,
  created_at         timestamptz not null default now()
);
create index if not exists payment_recovery_replies_membership_idx
  on public.payment_recovery_replies (membership_id, received_at);
alter table public.payment_recovery_replies enable row level security;
comment on table public.payment_recovery_replies is
  'Member replies to payment-recovery messages. channel discord_dm = a message the member sent in the bot DM channel; message_number = the latest recovery message sent to them when the reply arrived.';
-- No policies on purpose: only the service role reads or writes these tables.
