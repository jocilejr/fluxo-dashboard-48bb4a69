CREATE TABLE public.member_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  current_activity text DEFAULT 'viewing_home',
  current_product_name text,
  current_material_name text,
  page_url text,
  user_agent text
);

CREATE INDEX idx_member_sessions_phone ON member_sessions(normalized_phone);
CREATE INDEX idx_member_sessions_heartbeat ON member_sessions(last_heartbeat_at);

ALTER TABLE member_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert sessions" ON member_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon can update sessions" ON member_sessions FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can read sessions" ON member_sessions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.member_sessions;