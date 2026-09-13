-- Migration 017: cancel_feedback
-- Stores freeform messages submitted from the cancel flow's letter #5 ("Other" reason).
-- William queries this via the Supabase dashboard when he wants to read them.

create table public.cancel_feedback (
  id uuid primary key default gen_random_uuid(),
  whop_user_id text not null,
  session_id uuid not null,
  reason text,
  message text not null,
  created_at timestamptz not null default now()
);

create index cancel_feedback_created_at_idx on public.cancel_feedback (created_at desc);
create index cancel_feedback_whop_user_id_idx on public.cancel_feedback (whop_user_id);

alter table public.cancel_feedback enable row level security;

comment on table public.cancel_feedback is 'Freeform messages from the cancel flow (letter #5 / Other reason). Read by William via dashboard.';
comment on column public.cancel_feedback.whop_user_id is 'Whop user id of the member submitting the message.';
comment on column public.cancel_feedback.session_id is 'The cancel flow session id from cancel_flow_events, links this message to their gate journey.';
comment on column public.cancel_feedback.reason is 'The reason they picked on gate 1 before submitting the message. Usually "other" but not required.';
comment on column public.cancel_feedback.message is 'Their freeform message. William reads these.';
