
-- Update sync_customer_from_transaction to remove leading zero
CREATE OR REPLACE FUNCTION public.sync_customer_from_transaction()
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
BEGIN
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;

  norm_phone := regexp_replace(NEW.customer_phone, '[^0-9]', '', 'g');
  IF left(norm_phone, 1) = '0' THEN
    norm_phone := substring(norm_phone from 2);
  END IF;
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
    INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
    VALUES (
      norm_phone,
      NEW.customer_phone,
      NEW.customer_name,
      NEW.customer_email,
      NEW.customer_document,
      COALESCE(NEW.created_at, now()),
      COALESCE(NEW.created_at, now())
    );
  ELSE
    UPDATE customers
    SET
      display_phone = COALESCE(NEW.customer_phone, display_phone),
      name = COALESCE(NEW.customer_name, name),
      email = COALESCE(NEW.customer_email, email),
      document = COALESCE(NEW.customer_document, document),
      last_seen_at = GREATEST(last_seen_at, COALESCE(NEW.created_at, now())),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update sync_customer_from_abandoned to remove leading zero
CREATE OR REPLACE FUNCTION public.sync_customer_from_abandoned()
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
BEGIN
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;

  norm_phone := regexp_replace(NEW.customer_phone, '[^0-9]', '', 'g');
  IF left(norm_phone, 1) = '0' THEN
    norm_phone := substring(norm_phone from 2);
  END IF;
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
    INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
    VALUES (
      norm_phone,
      NEW.customer_phone,
      NEW.customer_name,
      NEW.customer_email,
      NEW.customer_document,
      COALESCE(NEW.created_at, now()),
      COALESCE(NEW.created_at, now())
    );
  ELSE
    UPDATE customers
    SET
      display_phone = COALESCE(NEW.customer_phone, display_phone),
      name = COALESCE(NEW.customer_name, name),
      email = COALESCE(NEW.customer_email, email),
      document = COALESCE(NEW.customer_document, document),
      last_seen_at = GREATEST(last_seen_at, COALESCE(NEW.created_at, now())),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update sync_customer_from_delivery_access to remove leading zero
CREATE OR REPLACE FUNCTION public.sync_customer_from_delivery_access()
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
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;

  norm_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  IF left(norm_phone, 1) = '0' THEN
    norm_phone := substring(norm_phone from 2);
  END IF;
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
    VALUES (norm_phone, NEW.phone, COALESCE(NEW.accessed_at, now()), COALESCE(NEW.accessed_at, now()));
  ELSE
    UPDATE customers
    SET
      last_seen_at = GREATEST(last_seen_at, COALESCE(NEW.accessed_at, now())),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update handle_new_delivery_link to remove leading zero
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
  IF left(norm_phone, 1) = '0' THEN
    norm_phone := substring(norm_phone from 2);
  END IF;
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

-- Update generate_phone_variations to also strip leading zero
CREATE OR REPLACE FUNCTION public.generate_phone_variations(phone text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
  base_with_ddd text;
  ddd text;
  rest_of_number text;
  with_9 text;
  without_9 text;
  variations text[];
BEGIN
  digits := regexp_replace(phone, '[^0-9]', '', 'g');
  IF left(digits, 1) = '0' THEN
    digits := substring(digits from 2);
  END IF;
  
  IF length(digits) < 8 THEN
    RETURN ARRAY[digits];
  END IF;
  
  variations := ARRAY[digits];
  
  base_with_ddd := digits;
  IF digits LIKE '55%' AND length(digits) >= 12 THEN
    base_with_ddd := substring(digits, 3);
    variations := variations || ARRAY[base_with_ddd];
  END IF;
  
  ddd := substring(base_with_ddd, 1, 2);
  rest_of_number := substring(base_with_ddd, 3);
  
  IF length(rest_of_number) = 9 AND substring(rest_of_number, 1, 1) = '9' THEN
    with_9 := rest_of_number;
    without_9 := substring(rest_of_number, 2);
  ELSIF length(rest_of_number) = 8 THEN
    without_9 := rest_of_number;
    with_9 := '9' || rest_of_number;
  ELSE
    RETURN variations || ARRAY['55' || base_with_ddd];
  END IF;
  
  variations := variations || ARRAY[
    ddd || without_9,
    ddd || with_9,
    '55' || ddd || without_9,
    '55' || ddd || with_9
  ];
  
  RETURN variations;
END;
$function$;

-- Force backfill ALL records (not just those with normalized_phone LIKE '0%')
UPDATE transactions SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL AND left(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 1) = '0';
UPDATE customers SET normalized_phone = normalize_phone(display_phone) WHERE display_phone IS NOT NULL AND left(regexp_replace(display_phone, '[^0-9]', '', 'g'), 1) = '0';
UPDATE abandoned_events SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL AND left(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 1) = '0';
