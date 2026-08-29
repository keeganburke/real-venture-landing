-- 010: member profiles for /dashboard/profile.
-- Keyed by the Whop user id carried in the signed rv_session cookie.

create table if not exists public.member_profiles (
  whop_user_id text primary key,
  display_name text not null default '',
  phone text,
  timezone text not null default 'America/Los_Angeles',
  headline text,
  bio text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;

-- No anon/authenticated policies on purpose. This app has no Supabase Auth,
-- so auth.jwt() policies would be inert; all access goes through the app's
-- API routes using the service role key (which bypasses RLS), gated by the
-- signed rv_session cookie. Enabling RLS with zero policies means the anon
-- key can touch nothing.

create or replace function public.set_member_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists member_profiles_updated_at on public.member_profiles;
create trigger member_profiles_updated_at
  before update on public.member_profiles
  for each row execute function public.set_member_profiles_updated_at();

-- Public bucket for profile photos. Uploads happen server-side with the
-- service role; public read so photo_url works as a plain <img> src.
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;
