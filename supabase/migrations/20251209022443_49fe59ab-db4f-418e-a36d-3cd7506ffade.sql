
-- Revert normalize_phone to ONLY remove non-digits, no other modifications
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
BEGIN
  -- Only remove non-digit characters, nothing else
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$function$;

-- Restore ALL normalized_phone to original digits from display_phone
UPDATE customers 
SET normalized_phone = regexp_replace(display_phone, '[^0-9]', '', 'g')
WHERE display_phone IS NOT NULL AND display_phone != '';

-- Also restore transactions
UPDATE transactions 
SET normalized_phone = regexp_replace(customer_phone, '[^0-9]', '', 'g')
WHERE customer_phone IS NOT NULL AND customer_phone != '';

-- Also restore abandoned_events
UPDATE abandoned_events 
SET normalized_phone = regexp_replace(customer_phone, '[^0-9]', '', 'g')
WHERE customer_phone IS NOT NULL AND customer_phone != '';
