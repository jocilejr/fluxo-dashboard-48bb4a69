-- Create function to sync delivery link generations to customers
CREATE OR REPLACE FUNCTION public.sync_delivery_leads_to_customers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert new customers from delivery_link_generations that don't exist yet
  INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at)
  SELECT DISTINCT 
    dlg.normalized_phone,
    dlg.phone as display_phone,
    MIN(dlg.created_at) as first_seen_at,
    MAX(dlg.created_at) as last_seen_at
  FROM delivery_link_generations dlg
  WHERE dlg.normalized_phone IS NOT NULL
    AND dlg.normalized_phone != ''
    AND NOT EXISTS (
      SELECT 1 FROM customers c WHERE c.normalized_phone = dlg.normalized_phone
    )
  GROUP BY dlg.normalized_phone, dlg.phone
  ON CONFLICT (normalized_phone) DO NOTHING;

  -- Update last_seen_at for existing customers if delivery link is more recent
  UPDATE customers c
  SET last_seen_at = dlg_latest.max_created
  FROM (
    SELECT normalized_phone, MAX(created_at) as max_created
    FROM delivery_link_generations
    WHERE normalized_phone IS NOT NULL AND normalized_phone != ''
    GROUP BY normalized_phone
  ) dlg_latest
  WHERE c.normalized_phone = dlg_latest.normalized_phone
    AND dlg_latest.max_created > c.last_seen_at;
END;
$$;

-- Create trigger function to sync on new delivery link generation
CREATE OR REPLACE FUNCTION public.handle_new_delivery_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update customer
  INSERT INTO customers (normalized_phone, display_phone, first_seen_at, last_seen_at)
  VALUES (NEW.normalized_phone, NEW.phone, NEW.created_at, NEW.created_at)
  ON CONFLICT (normalized_phone) DO UPDATE
  SET last_seen_at = GREATEST(customers.last_seen_at, NEW.created_at),
      display_phone = COALESCE(customers.display_phone, NEW.phone);
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_delivery_link_generated ON delivery_link_generations;
CREATE TRIGGER on_delivery_link_generated
  AFTER INSERT ON delivery_link_generations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_delivery_link();

-- Run initial sync to populate existing delivery leads
SELECT sync_delivery_leads_to_customers();