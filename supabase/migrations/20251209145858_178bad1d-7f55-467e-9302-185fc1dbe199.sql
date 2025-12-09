-- Atualizar a função refresh_customer_stats para também preencher o nome do cliente a partir das transações
CREATE OR REPLACE FUNCTION public.refresh_customer_stats(customer_normalized_phone text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  phone_variations text[];
  base_phone text;
  c_record RECORD;
  pix_total numeric := 0;
  pix_count integer := 0;
  latest_name text := NULL;
  latest_email text := NULL;
  latest_document text := NULL;
BEGIN
  FOR c_record IN 
    SELECT id, normalized_phone, name, email, document FROM customers 
    WHERE customer_normalized_phone IS NULL OR normalized_phone = customer_normalized_phone
  LOOP
    -- Generate phone variations for this customer
    base_phone := c_record.normalized_phone;
    phone_variations := generate_phone_variations(base_phone);
    
    -- Get the most recent customer info from transactions (only if customer doesn't have a name)
    IF c_record.name IS NULL OR c_record.name = '' THEN
      SELECT t.customer_name, t.customer_email, t.customer_document
      INTO latest_name, latest_email, latest_document
      FROM transactions t
      WHERE t.normalized_phone = ANY(phone_variations)
        AND t.customer_name IS NOT NULL 
        AND t.customer_name != ''
      ORDER BY t.created_at DESC
      LIMIT 1;
    END IF;
    
    -- Calculate PIX stats from delivery_link_generations
    SELECT 
      COUNT(*),
      COALESCE(SUM(dp.value), 0)
    INTO pix_count, pix_total
    FROM delivery_link_generations dlg
    LEFT JOIN delivery_products dp ON dp.id = dlg.product_id
    WHERE dlg.normalized_phone = ANY(phone_variations) 
      AND dlg.payment_method = 'pix';
    
    -- Update stats using all phone variations
    UPDATE customers SET
      name = COALESCE(c_record.name, latest_name, name),
      email = COALESCE(c_record.email, latest_email, email),
      document = COALESCE(c_record.document, latest_document, document),
      total_transactions = (
        SELECT COUNT(*) FROM transactions t 
        WHERE t.normalized_phone = ANY(phone_variations)
      ),
      total_paid = (
        SELECT COALESCE(SUM(amount), 0) FROM transactions t 
        WHERE t.normalized_phone = ANY(phone_variations) AND t.status = 'pago'
      ) + pix_total,
      total_pending = (
        SELECT COALESCE(SUM(amount), 0) FROM transactions t 
        WHERE t.normalized_phone = ANY(phone_variations) AND t.status IN ('gerado', 'pendente')
      ),
      total_abandoned_events = (
        SELECT COUNT(*) FROM abandoned_events a 
        WHERE a.normalized_phone = ANY(phone_variations)
      ),
      pix_payment_count = pix_count,
      updated_at = now()
    WHERE id = c_record.id;
  END LOOP;
END;
$function$;