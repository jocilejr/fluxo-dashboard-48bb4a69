-- Expand groups table with new columns for detailed n8n data
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS whatsapp_id TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 0;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS whatsapp_url TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS active_link TEXT;

-- Create unique index on whatsapp_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS groups_whatsapp_id_unique ON public.groups(whatsapp_id) WHERE whatsapp_id IS NOT NULL;