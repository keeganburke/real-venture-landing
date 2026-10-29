-- 028: Discord sweep runs (lib/discord-kick.ts runDiscordSweep).
-- One row per sweep. Two jobs:
--   1. Lease: one sweep at a time. The partial unique index allows a single
--      row with status 'running'; a second sweep's insert gets 23505 and
--      acts on no one. A lease older than lease_expires_at (10 minutes) is
--      flipped to 'expired' by the next sweep before it inserts its own.
--      The webhook kick path (checkOneFromWebhook) skips while a row is
--      running, and skips when this table cannot be read (fail closed).
--   2. Truncated-data guard: live_count of the last run with whop_read_ok is
--      the baseline; a new run whose live user count is below 90% of it
--      aborts before deciding anyone.
-- Service role only (same pattern as 024). The sweep aborts until this
-- migration has run, in shadow and live alike.

create table if not exists public.discord_sweep_runs (
  id               bigserial primary key,
  mode             text not null check (mode in ('shadow', 'live')),
  status           text not null check (status in ('running', 'ok', 'aborted', 'expired')),
  started_at       timestamptz not null default now(),
  lease_expires_at timestamptz not null,
  finished_at      timestamptz,
  -- true once the Whop read succeeded AND passed the drop guard; only these
  -- rows feed the next run's baseline (a cap abort still has a good read).
  whop_read_ok     boolean not null default false,
  rows_read        integer,
  live_count       integer,
  paused_count     integer,
  paid_time_count  integer,
  scanned          integer,
  candidates       integer,
  kicked           integer,
  would_kick       integer,
  failed           integer,
  dm_sent          integer,
  dm_failed        integer,
  aborted_reason   text
);

-- The lease: at most one running sweep.
create unique index if not exists discord_sweep_runs_one_running
  on public.discord_sweep_runs (status)
  where status = 'running';
create index if not exists discord_sweep_runs_started_idx
  on public.discord_sweep_runs (started_at desc);
alter table public.discord_sweep_runs enable row level security;
comment on table public.discord_sweep_runs is
  'One row per Discord auto-kick sweep: lease (one running row at a time, 10 minute expiry), Whop read counts (baseline for the truncated-data guard) and outcome.';
-- No policies on purpose: only the service role reads or writes this table.
