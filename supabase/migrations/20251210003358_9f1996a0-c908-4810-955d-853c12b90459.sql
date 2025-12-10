-- Corrigir handle_new_delivery_link para NÃO incrementar contadores manualmente
-- Pois refresh_customer_stats já faz a contagem correta
CREATE OR REPLACE FUNCTION public.handle_new_delivery_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  norm_phone text;
  phone_variations text[];
  existing_customer_id uuid;
BEGIN
  norm_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  NEW.normalized_phone := norm_phone;

  -- Gerar todas as variações do telefone para buscar cliente existente
  phone_variations := generate_phone_variations(norm_phone);
  
  -- Buscar cliente existente usando QUALQUER variação do telefone
  SELECT id INTO existing_customer_id
  FROM customers 
  WHERE normalized_phone = ANY(phone_variations)
  LIMIT 1;

  IF existing_customer_id IS NULL THEN
    -- Criar novo cliente com o telefone normalizado (stats serão calculadas pelo refresh)
    INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.phone, NEW.created_at, NEW.created_at);
  ELSE
    -- Apenas atualizar last_seen_at do cliente existente
    UPDATE customers SET
      last_seen_at = GREATEST(last_seen_at, NEW.created_at),
      display_phone = COALESCE(display_phone, NEW.phone),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;
  
  -- Chamar refresh_customer_stats para recalcular corretamente
  PERFORM refresh_customer_stats(norm_phone);
  
  RETURN NEW;
END;
$function$;