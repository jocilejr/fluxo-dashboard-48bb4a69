
-- Create messaging_api_settings table
CREATE TABLE public.messaging_api_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_url text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  boleto_recovery_enabled boolean NOT NULL DEFAULT false,
  pix_card_recovery_enabled boolean NOT NULL DEFAULT false,
  abandoned_recovery_enabled boolean NOT NULL DEFAULT false,
  delay_between_messages integer NOT NULL DEFAULT 5,
  daily_limit integer NOT NULL DEFAULT 100,
  cron_enabled boolean NOT NULL DEFAULT false,
  cron_interval_minutes integer NOT NULL DEFAULT 60,
  working_hours_enabled boolean NOT NULL DEFAULT false,
  working_hours_start integer NOT NULL DEFAULT 8,
  working_hours_end integer NOT NULL DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messaging_api_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage messaging settings"
  ON public.messaging_api_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view messaging settings"
  ON public.messaging_api_settings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Create message_log table (replaces evolution_message_log)
CREATE TABLE public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  external_response jsonb,
  external_message_id text,
  transaction_id uuid REFERENCES public.transactions(id),
  abandoned_event_id uuid REFERENCES public.abandoned_events(id),
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_log
CREATE POLICY "Admins can manage message logs"
  ON public.message_log FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert message logs"
  ON public.message_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update message logs"
  ON public.message_log FOR UPDATE
  USING (true);

CREATE POLICY "Users can view message logs"
  ON public.message_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Drop evolution_api_settings table
DROP TABLE IF EXISTS public.evolution_api_settings CASCADE;

-- Drop evolution_message_log table
DROP TABLE IF EXISTS public.evolution_message_log CASCADE;

-- Enable realtime for message_log
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_log;
