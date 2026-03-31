ALTER TABLE public.messaging_api_settings
  ADD COLUMN IF NOT EXISTS max_messages_per_person_per_day integer NOT NULL DEFAULT 1;