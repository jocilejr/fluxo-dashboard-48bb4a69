-- Rule: if last 8 digits match, treat as same customer

CREATE OR REPLACE FUNCTION public.refresh_customer_stats(customer_normalized_phone text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_record RECORD;
  phone_last8 text;
  pix_total numeric := 0;
  pix_count integer := 0;
  latest_name text := NULL;
  latest_email text := NULL;
  latest_document text := NULL;
BEGIN
  FOR c_record IN
    SELECT id, normalized_phone, name, email, document
    FROM customers
    WHERE customer_normalized_phone IS NULL OR normalized_phone = customer_normalized_phone
  LOOP
    phone_last8 := RIGHT(c_record.normalized_phone, 8);

    IF c_record.name IS NULL OR c_record.name = '' THEN
      SELECT t.customer_name, t.customer_email, t.customer_document
      INTO latest_name, latest_email, latest_document
      FROM transactions t
      WHERE t.normalized_phone IS NOT NULL
        AND LENGTH(t.normalized_phone) >= 8
        AND RIGHT(t.normalized_phone, 8) = phone_last8
        AND t.customer_name IS NOT NULL
        AND t.customer_name <> ''
      ORDER BY t.created_at DESC
      LIMIT 1;
    ELSE
      latest_name := NULL;
      latest_email := NULL;
      latest_document := NULL;
    END IF;

    SELECT COUNT(*), COALESCE(SUM(dp.value), 0)
    INTO pix_count, pix_total
    FROM delivery_link_generations dlg
    LEFT JOIN delivery_products dp ON dp.id = dlg.product_id
    WHERE dlg.normalized_phone IS NOT NULL
      AND LENGTH(dlg.normalized_phone) >= 8
      AND RIGHT(dlg.normalized_phone, 8) = phone_last8
      AND dlg.payment_method = 'pix';

    UPDATE customers
    SET
      name = COALESCE(c_record.name, latest_name, name),
      email = COALESCE(c_record.email, latest_email, email),
      document = COALESCE(c_record.document, latest_document, document),
      total_transactions = (
        SELECT COUNT(*)
        FROM transactions t
        WHERE t.normalized_phone IS NOT NULL
          AND LENGTH(t.normalized_phone) >= 8
          AND RIGHT(t.normalized_phone, 8) = phone_last8
      ),
      total_paid = (
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions t
        WHERE t.normalized_phone IS NOT NULL
          AND LENGTH(t.normalized_phone) >= 8
          AND RIGHT(t.normalized_phone, 8) = phone_last8
          AND t.status = 'pago'
      ) + pix_total,
      total_pending = (
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions t
        WHERE t.normalized_phone IS NOT NULL
          AND LENGTH(t.normalized_phone) >= 8
          AND RIGHT(t.normalized_phone, 8) = phone_last8
          AND t.status IN ('gerado', 'pendente')
      ),
      total_abandoned_events = (
        SELECT COUNT(*)
        FROM abandoned_events a
        WHERE a.normalized_phone IS NOT NULL
          AND LENGTH(a.normalized_phone) >= 8
          AND RIGHT(a.normalized_phone, 8) = phone_last8
      ),
      pix_payment_count = pix_count,
      updated_at = now()
    WHERE id = c_record.id;
  END LOOP;
END;
$function$;

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
  ELSE
    UPDATE customers
    SET
      last_seen_at = GREATEST(last_seen_at, NEW.created_at),
      display_phone = COALESCE(display_phone, NEW.phone),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;

  PERFORM refresh_customer_stats((SELECT normalized_phone FROM customers WHERE id = existing_customer_id LIMIT 1));

  RETURN NEW;
END;
$function$;