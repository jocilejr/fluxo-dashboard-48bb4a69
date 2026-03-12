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
  phone_last8 text;
  target_phone text;
BEGIN
  norm_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  NEW.normalized_phone := norm_phone;
  phone_last8 := RIGHT(norm_phone, 8);

  phone_variations := generate_phone_variations(norm_phone);

  SELECT id INTO existing_customer_id
  FROM customers
  WHERE normalized_phone = ANY(phone_variations)
  LIMIT 1;

  IF existing_customer_id IS NULL AND LENGTH(norm_phone) >= 8 THEN
    SELECT id INTO existing_customer_id
    FROM customers
    WHERE normalized_phone IS NOT NULL
      AND LENGTH(normalized_phone) >= 8
      AND RIGHT(normalized_phone, 8) = phone_last8
    LIMIT 1;
  END IF;

  IF existing_customer_id IS NULL THEN
    INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.phone, NEW.created_at, NEW.created_at);
    target_phone := norm_phone;
  ELSE
    UPDATE customers
    SET
      last_seen_at = GREATEST(last_seen_at, NEW.created_at),
      display_phone = COALESCE(display_phone, NEW.phone),
      updated_at = now()
    WHERE id = existing_customer_id;

    SELECT normalized_phone INTO target_phone
    FROM customers
    WHERE id = existing_customer_id;
  END IF;

  PERFORM refresh_customer_stats(COALESCE(target_phone, norm_phone));

  RETURN NEW;
END;
$function$;