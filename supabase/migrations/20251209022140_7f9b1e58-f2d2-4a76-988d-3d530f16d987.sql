
-- Revert normalize_phone to NOT force 9th digit - just clean and add country code
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
DECLARE
  normalized text;
BEGIN
  -- Remove all non-digit characters
  normalized := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Handle empty or too short
  IF length(normalized) < 8 THEN
    RETURN normalized;
  END IF;
  
  -- Add country code 55 if not present
  IF length(normalized) >= 10 AND length(normalized) <= 11 THEN
    normalized := '55' || normalized;
  END IF;
  
  -- Remove leading zeros after country code
  IF length(normalized) > 4 AND substring(normalized, 3, 1) = '0' THEN
    normalized := substring(normalized, 1, 2) || substring(normalized, 4);
  END IF;
  
  RETURN normalized;
END;
$function$;

-- Restore original normalized_phone values from display_phone
UPDATE customers SET normalized_phone = normalize_phone(display_phone)
WHERE display_phone IS NOT NULL AND display_phone != '';

UPDATE transactions SET normalized_phone = normalize_phone(customer_phone)
WHERE customer_phone IS NOT NULL AND customer_phone != '';

UPDATE abandoned_events SET normalized_phone = normalize_phone(customer_phone)
WHERE customer_phone IS NOT NULL AND customer_phone != '';
