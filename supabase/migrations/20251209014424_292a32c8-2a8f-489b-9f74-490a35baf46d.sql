
-- Update refresh_customer_stats to handle phone number variations (with/without 9th digit)
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
BEGIN
  FOR c_record IN 
    SELECT id, normalized_phone FROM customers 
    WHERE customer_normalized_phone IS NULL OR normalized_phone = customer_normalized_phone
  LOOP
    -- Generate phone variations for this customer
    base_phone := c_record.normalized_phone;
    
    -- Create variations: with and without the 9th digit for mobile numbers
    phone_variations := ARRAY[base_phone];
    
    -- If phone has 13 digits (55 + 2 DDD + 9 + 8 digits), also check 12 digit version
    IF length(base_phone) = 13 AND substring(base_phone, 5, 1) = '9' THEN
      phone_variations := phone_variations || ARRAY[substring(base_phone, 1, 4) || substring(base_phone, 6)];
    END IF;
    
    -- If phone has 12 digits (55 + 2 DDD + 8 digits), also check 13 digit version
    IF length(base_phone) = 12 THEN
      phone_variations := phone_variations || ARRAY[substring(base_phone, 1, 4) || '9' || substring(base_phone, 5)];
    END IF;
    
    -- Update stats using all phone variations
    UPDATE customers SET
      total_transactions = (
        SELECT COUNT(*) FROM transactions t 
        WHERE t.normalized_phone = ANY(phone_variations)
      ),
      total_paid = (
        SELECT COALESCE(SUM(amount), 0) FROM transactions t 
        WHERE t.normalized_phone = ANY(phone_variations) AND t.status = 'pago'
      ),
      total_pending = (
        SELECT COALESCE(SUM(amount), 0) FROM transactions t 
        WHERE t.normalized_phone = ANY(phone_variations) AND t.status IN ('gerado', 'pendente')
      ),
      total_abandoned_events = (
        SELECT COUNT(*) FROM abandoned_events a 
        WHERE a.normalized_phone = ANY(phone_variations)
      ),
      updated_at = now()
    WHERE id = c_record.id;
  END LOOP;
END;
$function$;

-- Also update the transaction trigger to check phone variations
CREATE OR REPLACE FUNCTION public.refresh_customer_on_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  norm_phone text;
  phone_variations text[];
  matching_customer_phone text;
BEGIN
  -- Get the normalized phone from the transaction
  norm_phone := COALESCE(NEW.normalized_phone, OLD.normalized_phone);
  
  -- If we have a phone, refresh the customer stats
  IF norm_phone IS NOT NULL AND norm_phone != '' THEN
    -- Generate phone variations
    phone_variations := ARRAY[norm_phone];
    
    -- If phone has 13 digits, also check 12 digit version
    IF length(norm_phone) = 13 AND substring(norm_phone, 5, 1) = '9' THEN
      phone_variations := phone_variations || ARRAY[substring(norm_phone, 1, 4) || substring(norm_phone, 6)];
    END IF;
    
    -- If phone has 12 digits, also check 13 digit version
    IF length(norm_phone) = 12 THEN
      phone_variations := phone_variations || ARRAY[substring(norm_phone, 1, 4) || '9' || substring(norm_phone, 5)];
    END IF;
    
    -- Find matching customer
    SELECT normalized_phone INTO matching_customer_phone 
    FROM customers 
    WHERE normalized_phone = ANY(phone_variations)
    LIMIT 1;
    
    IF matching_customer_phone IS NOT NULL THEN
      PERFORM refresh_customer_stats(matching_customer_phone);
    ELSE
      -- Try direct match
      PERFORM refresh_customer_stats(norm_phone);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Refresh all customer stats with new logic
SELECT refresh_customer_stats(NULL);
