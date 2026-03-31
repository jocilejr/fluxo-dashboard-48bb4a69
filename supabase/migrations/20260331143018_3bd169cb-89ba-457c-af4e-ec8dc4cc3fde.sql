ALTER TABLE public.messaging_api_settings
  ADD COLUMN IF NOT EXISTS last_recovery_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_recovery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_recovery_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_recovery_stats jsonb,
  ADD COLUMN IF NOT EXISTS last_recovery_error text;