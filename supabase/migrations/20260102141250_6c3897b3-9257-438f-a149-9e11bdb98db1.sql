-- Tabela de configurações da Evolution API
CREATE TABLE public.evolution_api_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_url TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  instance_name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  boleto_recovery_enabled BOOLEAN NOT NULL DEFAULT false,
  pix_card_recovery_enabled BOOLEAN NOT NULL DEFAULT false,
  abandoned_recovery_enabled BOOLEAN NOT NULL DEFAULT false,
  delay_between_messages INTEGER NOT NULL DEFAULT 5,
  daily_limit INTEGER NOT NULL DEFAULT 100,
  cron_enabled BOOLEAN NOT NULL DEFAULT false,
  cron_interval_minutes INTEGER NOT NULL DEFAULT 60,
  working_hours_start INTEGER NOT NULL DEFAULT 8,
  working_hours_end INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de log de mensagens enviadas
CREATE TABLE public.evolution_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  abandoned_event_id UUID REFERENCES public.abandoned_events(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  evolution_response JSONB,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_message_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_api_settings
CREATE POLICY "Admins can manage evolution settings" 
ON public.evolution_api_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view evolution settings" 
ON public.evolution_api_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- RLS Policies for evolution_message_log
CREATE POLICY "Admins can manage message logs" 
ON public.evolution_message_log 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view message logs" 
ON public.evolution_message_log 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert logs" 
ON public.evolution_message_log 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update logs" 
ON public.evolution_message_log 
FOR UPDATE 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_evolution_api_settings_updated_at
BEFORE UPDATE ON public.evolution_api_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_evolution_message_log_transaction_id ON public.evolution_message_log(transaction_id);
CREATE INDEX idx_evolution_message_log_abandoned_event_id ON public.evolution_message_log(abandoned_event_id);
CREATE INDEX idx_evolution_message_log_created_at ON public.evolution_message_log(created_at DESC);
CREATE INDEX idx_evolution_message_log_status ON public.evolution_message_log(status);
CREATE INDEX idx_evolution_message_log_message_type ON public.evolution_message_log(message_type);