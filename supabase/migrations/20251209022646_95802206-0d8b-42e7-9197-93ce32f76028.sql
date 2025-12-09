
-- Helper function to generate all phone variations for matching
CREATE OR REPLACE FUNCTION public.generate_phone_variations(phone text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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
  -- Remove all non-digit characters
  digits := regexp_replace(phone, '[^0-9]', '', 'g');
  
  IF length(digits) < 8 THEN
    RETURN ARRAY[digits];
  END IF;
  
  variations := ARRAY[digits];
  
  -- Remove country code if present
  base_with_ddd := digits;
  IF digits LIKE '55%' AND length(digits) >= 12 THEN
    base_with_ddd := substring(digits, 3);
    variations := variations || ARRAY[base_with_ddd];
  END IF;
  
  -- Get DDD and rest
  ddd := substring(base_with_ddd, 1, 2);
  rest_of_number := substring(base_with_ddd, 3);
  
  -- Determine if has 9th digit or not
  IF length(rest_of_number) = 9 AND substring(rest_of_number, 1, 1) = '9' THEN
    -- Has 9th digit
    with_9 := rest_of_number;
    without_9 := substring(rest_of_number, 2);
  ELSIF length(rest_of_number) = 8 THEN
    -- Without 9th digit
    without_9 := rest_of_number;
    with_9 := '9' || rest_of_number;
  ELSE
    -- Unknown format, return what we have
    RETURN variations || ARRAY['55' || base_with_ddd];
  END IF;
  
  -- Generate all 4 main variations
  variations := variations || ARRAY[
    ddd || without_9,           -- 10 digits
    ddd || with_9,              -- 11 digits
    '55' || ddd || without_9,   -- 12 digits
    '55' || ddd || with_9       -- 13 digits
  ];
  
  RETURN variations;
END;
$function$;

-- Update sync_customer_from_transaction to search all variations
CREATE OR REPLACE FUNCTION public.sync_customer_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  norm_phone text;
  phone_variations text[];
  existing_customer_id uuid;
BEGIN
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- Just remove non-digits
  norm_phone := regexp_replace(NEW.customer_phone, '[^0-9]', '', 'g');
  NEW.normalized_phone := norm_phone;
  
  -- Generate all variations and search for existing customer
  phone_variations := generate_phone_variations(norm_phone);
  
  SELECT id INTO existing_customer_id 
  FROM customers 
  WHERE normalized_phone = ANY(phone_variations)
  LIMIT 1;
  
  IF existing_customer_id IS NULL THEN
    -- Create new customer
    INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.customer_phone, NEW.customer_name, NEW.customer_email, NEW.customer_document, COALESCE(NEW.created_at, now()), COALESCE(NEW.created_at, now()));
  ELSE
    -- Update existing customer
    UPDATE customers SET
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

-- Update sync_customer_from_abandoned
CREATE OR REPLACE FUNCTION public.sync_customer_from_abandoned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  norm_phone text;
  phone_variations text[];
  existing_customer_id uuid;
BEGIN
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;
  
  norm_phone := regexp_replace(NEW.customer_phone, '[^0-9]', '', 'g');
  NEW.normalized_phone := norm_phone;
  
  phone_variations := generate_phone_variations(norm_phone);
  
  SELECT id INTO existing_customer_id 
  FROM customers 
  WHERE normalized_phone = ANY(phone_variations)
  LIMIT 1;
  
  IF existing_customer_id IS NULL THEN
    INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.customer_phone, NEW.customer_name, NEW.customer_email, NEW.customer_document, COALESCE(NEW.created_at, now()), COALESCE(NEW.created_at, now()));
  ELSE
    UPDATE customers SET
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

-- Update sync_customer_from_delivery_access
CREATE OR REPLACE FUNCTION public.sync_customer_from_delivery_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  norm_phone text;
  phone_variations text[];
  existing_customer_id uuid;
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  
  norm_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  
  phone_variations := generate_phone_variations(norm_phone);
  
  SELECT id INTO existing_customer_id 
  FROM customers 
  WHERE normalized_phone = ANY(phone_variations)
  LIMIT 1;
  
  IF existing_customer_id IS NULL THEN
    INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.phone, COALESCE(NEW.accessed_at, now()), COALESCE(NEW.accessed_at, now()));
  ELSE
    UPDATE customers SET
      last_seen_at = GREATEST(last_seen_at, COALESCE(NEW.accessed_at, now())),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update handle_new_delivery_link
CREATE OR REPLACE FUNCTION public.handle_new_delivery_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  product_value numeric := 0;
  norm_phone text;
  phone_variations text[];
  existing_customer_id uuid;
BEGIN
  norm_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  NEW.normalized_phone := norm_phone;
  
  IF NEW.payment_method = 'pix' THEN
    SELECT COALESCE(value, 0) INTO product_value
    FROM delivery_products
    WHERE id = NEW.product_id;
  END IF;

  phone_variations := generate_phone_variations(norm_phone);
  
  SELECT id INTO existing_customer_id 
  FROM customers 
  WHERE normalized_phone = ANY(phone_variations)
  LIMIT 1;

  IF existing_customer_id IS NULL THEN
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
