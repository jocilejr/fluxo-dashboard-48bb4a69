ALTER TABLE public.messaging_api_settings
  ADD COLUMN boleto_instance_name TEXT DEFAULT NULL,
  ADD COLUMN pix_card_instance_name TEXT DEFAULT NULL,
  ADD COLUMN abandoned_instance_name TEXT DEFAULT NULL;