
-- Create trigger to refresh customer stats when transaction status changes
CREATE OR REPLACE FUNCTION public.refresh_customer_on_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  norm_phone text;
BEGIN
  -- Get the normalized phone from the transaction
  norm_phone := COALESCE(NEW.normalized_phone, OLD.normalized_phone);
  
  -- If we have a phone, refresh the customer stats
  IF norm_phone IS NOT NULL AND norm_phone != '' THEN
    PERFORM refresh_customer_stats(norm_phone);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS refresh_customer_stats_on_insert ON transactions;
CREATE TRIGGER refresh_customer_stats_on_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_customer_on_transaction_change();

-- Create trigger for UPDATE
DROP TRIGGER IF EXISTS refresh_customer_stats_on_update ON transactions;
CREATE TRIGGER refresh_customer_stats_on_update
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_customer_on_transaction_change();

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS refresh_customer_stats_on_delete ON transactions;
CREATE TRIGGER refresh_customer_stats_on_delete
  AFTER DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_customer_on_transaction_change();

-- Now refresh the stats for the customer in question
SELECT refresh_customer_stats('5519974089330');
