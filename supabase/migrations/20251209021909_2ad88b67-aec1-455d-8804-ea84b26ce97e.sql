
-- Fix search_path for normalize_phone function
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
DECLARE
  normalized text;
  ddd text;
  number_part text;
BEGIN
  -- Remove all non-digit characters
  normalized := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Handle empty or too short
  IF length(normalized) < 8 THEN
    RETURN normalized;
  END IF;
  
  -- Remove country code 55 if present
  IF normalized LIKE '55%' AND length(normalized) >= 12 THEN
    normalized := substring(normalized, 3);
  END IF;
  
  -- Remove leading zeros
  IF length(normalized) > 0 AND substring(normalized, 1, 1) = '0' THEN
    normalized := substring(normalized, 2);
  END IF;
  
  -- Now we should have DDD + number (10 or 11 digits)
  IF length(normalized) = 11 AND substring(normalized, 3, 1) = '9' THEN
    ddd := substring(normalized, 1, 2);
    number_part := substring(normalized, 3);
  ELSIF length(normalized) = 10 THEN
    ddd := substring(normalized, 1, 2);
    number_part := '9' || substring(normalized, 3);
  ELSIF length(normalized) = 11 THEN
    ddd := substring(normalized, 1, 2);
    number_part := substring(normalized, 3);
  ELSE
    RETURN '55' || normalized;
  END IF;
  
  RETURN '55' || ddd || number_part;
END;
$function$;
