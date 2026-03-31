
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(phone, '[^0-9]', '', 'g');
  IF left(digits, 1) = '0' THEN
    digits := substring(digits from 2);
  END IF;
  RETURN digits;
END;
$function$;

UPDATE customers SET normalized_phone = normalize_phone(display_phone) WHERE display_phone IS NOT NULL AND normalized_phone LIKE '0%';
UPDATE transactions SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL AND normalized_phone LIKE '0%';
UPDATE abandoned_events SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL AND normalized_phone LIKE '0%';
