-- Add delivery link message template to delivery_settings
ALTER TABLE public.delivery_settings 
ADD COLUMN IF NOT EXISTS link_message_template TEXT DEFAULT 'Muito obrigada pela contribuição meu bem, vou deixar aqui o seu link de acesso 👇

{link}';