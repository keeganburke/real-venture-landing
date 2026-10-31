-- 030: payment-recovery drip follows Whop's retry schedule (lib/payment-recovery.ts).
-- The drip now runs while Whop keeps a membership past_due, up to 14
-- America/Chicago calendar days after the failed renewal (was a fixed 5
-- days), with copy picked by message number instead of by day.
--   day            Chicago calendar day of the failure sequence, 1 to 14
--                  (dedupe key with membership_id, failed_at, channel: one
--                  message per membership per calendar day).
--   message_number which message of the sequence a row is (1, 2, 3 ...);
--                  the next message number is the count of distinct days
--                  already claimed + 1. Nullable so rows written before
--                  this migration stay valid.
--   payment_recovery.other_live_flagged_at
--                  set when the drip has posted the "Duplicate past_due"
--                  mod line for this failure sequence (the same Whop user
--                  holds another live membership, so the past_due one is
--                  never messaged). Reset with the row on a newer failure.
-- 026 and 027 are applied; this only widens 026's day check and adds columns.

alter table public.payment_recovery_sends
  drop constraint if exists payment_recovery_sends_day_check;
alter table public.payment_recovery_sends
  add constraint payment_recovery_sends_day_check
  check (day between 1 and 14);
alter table public.payment_recovery_sends
  add column if not exists message_number int;
comment on column public.payment_recovery_sends.day is
  'Chicago calendar day of the failure sequence (1 = day of failed_at, max 14). Dedupe: one message per membership per day.';
comment on column public.payment_recovery_sends.message_number is
  'Which message of the failure sequence this send was (1, 2, 3 ...). Copy is chosen by this, not by day.';
comment on table public.payment_recovery_sends is
  'One row per (membership, failed_at, calendar day, channel). channel: ghl = email webhook, ghl_sms = SMS webhook, discord_dm = bot DM. The unique constraint is the dedupe: a second run that tries the same day of the same failure sequence gets 23505 and sends nothing.';

alter table public.payment_recovery
  add column if not exists other_live_flagged_at timestamptz;
comment on column public.payment_recovery.other_live_flagged_at is
  'Set when the Duplicate past_due mod line was posted for this failure sequence; the member holds another live membership and is not messaged.';
