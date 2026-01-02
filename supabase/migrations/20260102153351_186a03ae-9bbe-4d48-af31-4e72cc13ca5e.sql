-- Add working_hours_enabled field to evolution_api_settings
ALTER TABLE public.evolution_api_settings 
ADD COLUMN IF NOT EXISTS working_hours_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.evolution_api_settings.working_hours_enabled IS 
  'Se habilitado, respeita o horário de trabalho. Se desabilitado, funciona 24h.';