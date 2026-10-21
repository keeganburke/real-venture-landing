-- 024: Discord auto-kick (webhook + nightly sweep).
-- Allowlist is edited by hand in Supabase; the log records every decision
-- the kick code makes. Both are service-role only (same pattern as 011/014/023).

create table if not exists public.discord_kick_allowlist (
  discord_user_id text primary key,
  note            text,
  created_at      timestamptz not null default now()
);
alter table public.discord_kick_allowlist enable row level security;
comment on table public.discord_kick_allowlist is
  'Discord user ids the auto-kick must never remove. Add friends, paused members, staff alts here.';

create table if not exists public.discord_kick_log (
  id              bigserial primary key,
  discord_user_id text not null,
  whop_user_ids   text[] not null default '{}',
  reason          text not null,
  mode            text not null check (mode in ('shadow', 'live')),
  action          text not null check (action in ('kicked', 'would_kick', 'skipped', 'failed')),
  source          text not null check (source in ('webhook', 'sweep')),
  created_at      timestamptz not null default now()
);
create index if not exists discord_kick_log_created_idx
  on public.discord_kick_log (created_at desc);
create index if not exists discord_kick_log_discord_user_idx
  on public.discord_kick_log (discord_user_id, created_at desc);
alter table public.discord_kick_log enable row level security;
comment on table public.discord_kick_log is
  'One row per auto-kick decision worth keeping: every kick / would_kick / failed, and every skip of a member who holds a member role.';
-- No policies on purpose: only the service role reads or writes these tables.
