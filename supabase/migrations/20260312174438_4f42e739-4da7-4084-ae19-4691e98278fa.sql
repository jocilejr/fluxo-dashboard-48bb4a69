ALTER TABLE public.member_area_settings 
ADD COLUMN IF NOT EXISTS greeting_prompt text,
ADD COLUMN IF NOT EXISTS offer_prompt text;