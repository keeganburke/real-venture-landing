CREATE TABLE cancel_flow_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  membership_id text,
  session_id uuid NOT NULL,
  plan text,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_cancel_flow_events_user_id ON cancel_flow_events(user_id);
CREATE INDEX idx_cancel_flow_events_session_id ON cancel_flow_events(session_id);
CREATE INDEX idx_cancel_flow_events_event_type ON cancel_flow_events(event_type);
CREATE INDEX idx_cancel_flow_events_created_at ON cancel_flow_events(created_at DESC);

-- RLS: only service role can write, no one reads via API (analytics happens via direct DB)
ALTER TABLE cancel_flow_events ENABLE ROW LEVEL SECURITY;
