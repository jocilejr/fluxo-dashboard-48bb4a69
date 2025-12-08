-- Drop and recreate the trigger function to properly handle pix_payment_count
CREATE OR REPLACE FUNCTION public.handle_new_delivery_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  product_value numeric := 0;
BEGIN
  -- Get product value if payment method is pix
  IF NEW.payment_method = 'pix' THEN
    SELECT COALESCE(value, 0) INTO product_value
    FROM delivery_products
    WHERE id = NEW.product_id;
  END IF;

  -- Insert or update customer with pix payment tracking
  INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at, pix_payment_count, total_paid)
  VALUES (
    NEW.normalized_phone, 
    NEW.phone, 
    NEW.created_at, 
    NEW.created_at,
    CASE WHEN NEW.payment_method = 'pix' THEN 1 ELSE 0 END,
    CASE WHEN NEW.payment_method = 'pix' THEN product_value ELSE 0 END
  )
  ON CONFLICT (normalized_phone) DO UPDATE
  SET last_seen_at = GREATEST(customers.last_seen_at, NEW.created_at),
      display_phone = COALESCE(customers.display_phone, NEW.phone),
      pix_payment_count = CASE 
        WHEN NEW.payment_method = 'pix' THEN customers.pix_payment_count + 1 
        ELSE customers.pix_payment_count 
      END,
      total_paid = CASE 
        WHEN NEW.payment_method = 'pix' THEN customers.total_paid + product_value 
        ELSE customers.total_paid 
      END;
  
  RETURN NEW;
END;
$function$;