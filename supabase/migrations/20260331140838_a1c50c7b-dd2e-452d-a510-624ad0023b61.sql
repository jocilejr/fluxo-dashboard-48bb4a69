ALTER TABLE public.messaging_api_settings
  ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS batch_pause_seconds integer NOT NULL DEFAULT 30;