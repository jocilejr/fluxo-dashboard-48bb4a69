-- Create function to sync customer from delivery access
CREATE OR REPLACE FUNCTION public.sync_customer_from_delivery_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  norm_phone text;
  existing_customer_id uuid;
BEGIN
  -- Only process if we have a phone
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- Normalize the phone
  norm_phone := normalize_phone(NEW.phone);
  
  -- Check if customer exists
  SELECT id INTO existing_customer_id FROM customers WHERE normalized_phone = norm_phone;
  
  IF existing_customer_id IS NULL THEN
    -- Create new customer
    INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.phone, COALESCE(NEW.accessed_at, now()), COALESCE(NEW.accessed_at, now()));
  ELSE
    -- Update existing customer with latest access time
    UPDATE customers SET
      last_seen_at = GREATEST(last_seen_at, COALESCE(NEW.accessed_at, now())),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on delivery_accesses
CREATE TRIGGER sync_customer_on_delivery_access
  BEFORE INSERT ON public.delivery_accesses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_from_delivery_access();

-- Sync existing delivery accesses to customers (fixed GROUP BY)
INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at)
SELECT 
  normalize_phone(phone) as normalized_phone,
  MAX(phone) as display_phone,
  MIN(accessed_at) as first_seen_at,
  MAX(accessed_at) as last_seen_at
FROM delivery_accesses
WHERE phone IS NOT NULL AND phone != ''
GROUP BY normalize_phone(phone)
ON CONFLICT (normalized_phone) 
DO UPDATE SET
  last_seen_at = GREATEST(customers.last_seen_at, EXCLUDED.last_seen_at),
  updated_at = now();