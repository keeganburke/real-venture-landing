-- Migration 011: discord_connections table
-- Enforces 1:1 mapping between Whop users and Discord users.
-- Both columns are unique to prevent:
--   - One Whop account binding multiple Discord accounts (multi-Discord exploit)
--   - One Discord account bound to multiple Whop accounts
--
-- Populated by: /api/discord/callback (on successful role assignment)
--               /api/whop/webhook   (on cancellation, delete the row)
-- Access:      service role only (RLS denies all anon/authenticated access)

create table if not exists public.discord_connections (
  whop_user_id     text primary key,
  discord_user_id  text unique not null,
  tier             text check (tier in ('Base', 'Pro')),
  role_id          text,
  connected_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table  public.discord_connections is 'Enforces 1:1 mapping of Whop user to Discord user. Written by /api/discord/callback and /api/whop/webhook.';
comment on column public.discord_connections.whop_user_id    is 'Whop user id (matches member_profiles.whop_user_id). Primary key.';
comment on column public.discord_connections.discord_user_id is 'Discord user id. Unique: one Discord account per Whop account.';
comment on column public.discord_connections.tier            is 'Tier at time of connection (Base | Pro). Updated on tier swap.';
comment on column public.discord_connections.role_id         is 'Discord role id currently assigned to this user.';

-- RLS: service role only. Anon and authenticated get nothing.
alter table public.discord_connections enable row level security;

-- Auto-update updated_at on any UPDATE
create or replace function public.discord_connections_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_discord_connections_touch on public.discord_connections;
create trigger trg_discord_connections_touch
  before update on public.discord_connections
  for each row execute function public.discord_connections_touch_updated_at();
