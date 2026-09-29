-- 019: cache display names from Whop and Discord
alter table public.member_profiles
  add column if not exists whop_display_name text,
  add column if not exists whop_username text;

alter table public.discord_connections
  add column if not exists discord_username text;

comment on column public.member_profiles.whop_display_name is
  'Whop user.name (real name if set). Backfilled from Whop API.';
comment on column public.member_profiles.whop_username is
  'Whop user.username (handle). Backfilled from Whop API.';
comment on column public.discord_connections.discord_username is
  'Discord user.username at time of role assignment. Saved by callback for admin display.';
