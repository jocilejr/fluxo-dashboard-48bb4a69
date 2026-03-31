ALTER TABLE public.boleto_recovery_rules ADD COLUMN media_blocks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.messaging_api_settings DROP COLUMN boleto_send_pdf;