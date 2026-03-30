
ALTER TABLE public.messaging_api_settings 
  ADD COLUMN IF NOT EXISTS auto_pix_card_message text NOT NULL DEFAULT 'Olá {primeiro_nome}! Notamos que seu pagamento de {valor} está pendente. Podemos ajudar?',
  ADD COLUMN IF NOT EXISTS auto_abandoned_message text NOT NULL DEFAULT 'Olá {primeiro_nome}! Vi que você demonstrou interesse em nossos produtos. Posso ajudar você a finalizar sua compra?',
  ADD COLUMN IF NOT EXISTS auto_boleto_message text NOT NULL DEFAULT '{saudação}, {primeiro_nome}! Seu boleto de {valor} referente a {produto} vence em {vencimento}. Não deixe passar!';
