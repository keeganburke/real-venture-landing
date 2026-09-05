create table if not exists public.webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  metadata jsonb
);

create index if not exists webhook_events_event_type_idx
  on public.webhook_events(event_type, processed_at desc);

alter table public.webhook_events enable row level security;

comment on table public.webhook_events is 'Idempotency guard for Whop webhook processing. event_id = Whop event/idempotency key. Row exists = already handled, skip.';
