-- Function to normalize phone numbers (remove +, spaces, dashes, parentheses, etc.)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
BEGIN
  -- Remove all non-digit characters
  normalized := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- If starts with 55 and has 12-13 digits, it's already with country code
  -- If has 10-11 digits, add 55 prefix
  IF length(normalized) >= 10 AND length(normalized) <= 11 THEN
    normalized := '55' || normalized;
  END IF;
  
  -- Remove leading zeros after country code
  IF length(normalized) > 4 AND substring(normalized, 3, 1) = '0' THEN
    normalized := substring(normalized, 1, 2) || substring(normalized, 4);
  END IF;
  
  RETURN normalized;
END;
$$;

-- Table to store unified customer data
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  normalized_phone text NOT NULL UNIQUE,
  display_phone text, -- Original format for display
  name text,
  email text,
  document text,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  total_transactions integer NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  total_pending numeric NOT NULL DEFAULT 0,
  total_abandoned_events integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view customers"
ON public.customers
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_customers_normalized_phone ON public.customers(normalized_phone);
CREATE INDEX idx_customers_last_seen ON public.customers(last_seen_at DESC);

-- Add normalized_phone column to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS normalized_phone text;

-- Add normalized_phone column to abandoned_events
ALTER TABLE public.abandoned_events 
ADD COLUMN IF NOT EXISTS normalized_phone text;

-- Create indexes for joining
CREATE INDEX IF NOT EXISTS idx_transactions_normalized_phone ON public.transactions(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_abandoned_normalized_phone ON public.abandoned_events(normalized_phone);

-- Function to sync customer from transaction
CREATE OR REPLACE FUNCTION public.sync_customer_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_phone text;
  existing_customer_id uuid;
BEGIN
  -- Only process if we have a phone
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- Normalize the phone
  norm_phone := normalize_phone(NEW.customer_phone);
  NEW.normalized_phone := norm_phone;
  
  -- Check if customer exists
  SELECT id INTO existing_customer_id FROM customers WHERE normalized_phone = norm_phone;
  
  IF existing_customer_id IS NULL THEN
    -- Create new customer
    INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.customer_phone, NEW.customer_name, NEW.customer_email, NEW.customer_document, COALESCE(NEW.created_at, now()), COALESCE(NEW.created_at, now()));
  ELSE
    -- Update existing customer with latest info
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
$$;

-- Function to sync customer from abandoned event
CREATE OR REPLACE FUNCTION public.sync_customer_from_abandoned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_phone text;
  existing_customer_id uuid;
BEGIN
  -- Only process if we have a phone
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- Normalize the phone
  norm_phone := normalize_phone(NEW.customer_phone);
  NEW.normalized_phone := norm_phone;
  
  -- Check if customer exists
  SELECT id INTO existing_customer_id FROM customers WHERE normalized_phone = norm_phone;
  
  IF existing_customer_id IS NULL THEN
    -- Create new customer
    INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
    VALUES (norm_phone, NEW.customer_phone, NEW.customer_name, NEW.customer_email, NEW.customer_document, COALESCE(NEW.created_at, now()), COALESCE(NEW.created_at, now()));
  ELSE
    -- Update existing customer with latest info
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
$$;

-- Create triggers
CREATE TRIGGER sync_customer_on_transaction
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_from_transaction();

CREATE TRIGGER sync_customer_on_abandoned
BEFORE INSERT OR UPDATE ON public.abandoned_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_from_abandoned();

-- Function to update customer stats (called periodically or on-demand)
CREATE OR REPLACE FUNCTION public.refresh_customer_stats(customer_normalized_phone text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers c SET
    total_transactions = (
      SELECT COUNT(*) FROM transactions t 
      WHERE t.normalized_phone = c.normalized_phone
    ),
    total_paid = (
      SELECT COALESCE(SUM(amount), 0) FROM transactions t 
      WHERE t.normalized_phone = c.normalized_phone AND t.status = 'pago'
    ),
    total_pending = (
      SELECT COALESCE(SUM(amount), 0) FROM transactions t 
      WHERE t.normalized_phone = c.normalized_phone AND t.status IN ('gerado', 'pendente')
    ),
    total_abandoned_events = (
      SELECT COUNT(*) FROM abandoned_events a 
      WHERE a.normalized_phone = c.normalized_phone
    ),
    updated_at = now()
  WHERE customer_normalized_phone IS NULL OR c.normalized_phone = customer_normalized_phone;
END;
$$;

-- Backfill normalized_phone for existing transactions
UPDATE transactions SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL AND normalized_phone IS NULL;

-- Backfill normalized_phone for existing abandoned_events
UPDATE abandoned_events SET normalized_phone = normalize_phone(customer_phone) WHERE customer_phone IS NOT NULL AND normalized_phone IS NULL;

-- Backfill customers from existing data
INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
SELECT DISTINCT ON (normalize_phone(customer_phone))
  normalize_phone(customer_phone),
  customer_phone,
  customer_name,
  customer_email,
  customer_document,
  MIN(created_at) OVER (PARTITION BY normalize_phone(customer_phone)),
  MAX(created_at) OVER (PARTITION BY normalize_phone(customer_phone))
FROM transactions
WHERE customer_phone IS NOT NULL AND customer_phone != ''
ON CONFLICT (normalized_phone) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, customers.name),
  email = COALESCE(EXCLUDED.email, customers.email),
  document = COALESCE(EXCLUDED.document, customers.document),
  last_seen_at = GREATEST(customers.last_seen_at, EXCLUDED.last_seen_at);

-- Also backfill from abandoned_events
INSERT INTO customers (normalized_phone, display_phone, name, email, document, first_seen_at, last_seen_at)
SELECT DISTINCT ON (normalize_phone(customer_phone))
  normalize_phone(customer_phone),
  customer_phone,
  customer_name,
  customer_email,
  customer_document,
  MIN(created_at) OVER (PARTITION BY normalize_phone(customer_phone)),
  MAX(created_at) OVER (PARTITION BY normalize_phone(customer_phone))
FROM abandoned_events
WHERE customer_phone IS NOT NULL AND customer_phone != ''
ON CONFLICT (normalized_phone) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, customers.name),
  email = COALESCE(EXCLUDED.email, customers.email),
  document = COALESCE(EXCLUDED.document, customers.document),
  last_seen_at = GREATEST(customers.last_seen_at, EXCLUDED.last_seen_at);

-- Refresh all customer stats
SELECT refresh_customer_stats();