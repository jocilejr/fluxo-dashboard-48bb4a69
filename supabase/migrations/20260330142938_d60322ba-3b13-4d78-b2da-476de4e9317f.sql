ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS external_id text;
CREATE INDEX IF NOT EXISTS idx_reminders_external_id ON public.reminders(external_id);