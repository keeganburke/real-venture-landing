-- 027: payment-recovery drip, second GHL webhook for SMS.
-- lib/payment-recovery.ts now records the SMS webhook POST as its own
-- payment_recovery_sends row (channel 'ghl_sms') next to the email webhook
-- row ('ghl') and the bot DM row ('discord_dm'), so one failing never blocks
-- the other. 026 is already applied, so this widens its channel check.
-- Dedupe key (membership_id, failed_at, day, channel) is unchanged.
-- Must run before RECOVERY_MODE=live; until then an SMS claim fails the
-- check, is logged, and only the email webhook (and DM) are sent.

alter table public.payment_recovery_sends
  drop constraint if exists payment_recovery_sends_channel_check;
alter table public.payment_recovery_sends
  add constraint payment_recovery_sends_channel_check
  check (channel in ('ghl', 'ghl_sms', 'discord_dm'));
comment on table public.payment_recovery_sends is
  'One row per (membership, failed_at, drip day, channel). channel: ghl = email webhook, ghl_sms = SMS webhook, discord_dm = bot DM. The unique constraint is the dedupe: a second run that tries the same day of the same failure sequence gets 23505 and sends nothing.';
