-- Update refresh_customer_stats to also recalculate pix_payment_count and include PIX values in total_paid
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
BEGIN
  FOR c_record IN 
    SELECT id, normalized_phone FROM customers 
    WHERE customer_normalized_phone IS NULL OR normalized_phone = customer_normalized_phone
  LOOP
    -- Generate phone variations for this customer
    base_phone := c_record.normalized_phone;
    phone_variations := generate_phone_variations(base_phone);
    
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