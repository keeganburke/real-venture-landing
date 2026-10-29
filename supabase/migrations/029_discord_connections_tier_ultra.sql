-- 029: allow tier 'Ultra' on discord_connections.
-- 011 created the column with check (tier in ('Base', 'Pro')). The connect
-- flow (app/api/discord/callback) has written 'Ultra' since the Ultra plans
-- shipped, so every Ultra connect's upsert failed on this check (logged
-- only): the member got the roles but no discord_connections row, which
-- makes them invisible to the auto-kick sweep (no_link). 2026-10-29: 0 rows
-- carry 'Ultra', while 19 guild members hold Pro + Ultra with no link.
-- Proposed alongside 028; separate so it can be run or dropped on its own.

alter table public.discord_connections
  drop constraint if exists discord_connections_tier_check;
alter table public.discord_connections
  add constraint discord_connections_tier_check
  check (tier in ('Base', 'Pro', 'Ultra'));
comment on column public.discord_connections.tier is
  'Tier at time of connection (Base | Pro | Ultra). Updated on reconnect.';
