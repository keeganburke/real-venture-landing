-- One free-days claim per user, enforced by the database. The add-free-days
-- route inserts its guard row first; concurrent requests race the insert and
-- Postgres lets exactly one through (loser gets error 23505).
--
-- PRECONDITION before running: this fails if any user already has duplicate
-- free_days_accepted rows from the client-side tracking era. Check first:
--   SELECT user_id, count(*) FROM cancel_flow_events
--   WHERE event_type = 'free_days_accepted'
--   GROUP BY user_id HAVING count(*) > 1;
-- and dedupe (keep the earliest row) if that returns anything.

CREATE UNIQUE INDEX cancel_flow_events_one_free_days_per_user
ON cancel_flow_events (user_id)
WHERE event_type = 'free_days_accepted';
