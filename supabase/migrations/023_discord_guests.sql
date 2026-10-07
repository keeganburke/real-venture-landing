create table if not exists public.discord_guests (
  discord_user_id   text primary key,
  discord_username  text,
  discord_email     text,
  joined_at         timestamptz not null default now(),
  already_in_server boolean not null default false,
  source            text not null default 'free_page'
);
alter table public.discord_guests enable row level security;
-- No policies on purpose: only the service role reads or writes this table.
