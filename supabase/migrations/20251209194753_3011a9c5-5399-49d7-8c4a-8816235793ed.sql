
-- Corrigir o trigger handle_new_delivery_link para usar phone variations na busca E normalizar corretamente
CREATE OR REPLACE FUNCTION public.handle_new_delivery_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  product_value numeric := 0;
  norm_phone text;
  phone_variations text[];
  existing_customer_id uuid;
  existing_customer_phone text;
BEGIN
  norm_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  NEW.normalized_phone := norm_phone;
  
  IF NEW.payment_method = 'pix' THEN
    SELECT COALESCE(value, 0) INTO product_value
    FROM delivery_products
    WHERE id = NEW.product_id;
  END IF;

  -- Gerar todas as variações do telefone para buscar cliente existente
  phone_variations := generate_phone_variations(norm_phone);
  
  -- Buscar cliente existente usando QUALQUER variação do telefone
  SELECT id, normalized_phone INTO existing_customer_id, existing_customer_phone
  FROM customers 
  WHERE normalized_phone = ANY(phone_variations)
  LIMIT 1;

  IF existing_customer_id IS NULL THEN
    -- Criar novo cliente com o telefone normalizado
    INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at, pix_payment_count, total_paid)
    VALUES (
      norm_phone, 
      NEW.phone, 
      NEW.created_at, 
      NEW.created_at,
      CASE WHEN NEW.payment_method = 'pix' THEN 1 ELSE 0 END,
      CASE WHEN NEW.payment_method = 'pix' THEN product_value ELSE 0 END
    );
  ELSE
    -- Atualizar cliente existente
    UPDATE customers SET
      last_seen_at = GREATEST(last_seen_at, NEW.created_at),
      display_phone = COALESCE(display_phone, NEW.phone),
      pix_payment_count = CASE 
        WHEN NEW.payment_method = 'pix' THEN pix_payment_count + 1 
        ELSE pix_payment_count 
      END,
      total_paid = CASE 
        WHEN NEW.payment_method = 'pix' THEN total_paid + product_value 
        ELSE total_paid 
      END,
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Agora atualizar os clientes que não foram contabilizados corretamente
-- Primeiro, vamos chamar refresh_customer_stats para todos os clientes
SELECT refresh_customer_stats();
