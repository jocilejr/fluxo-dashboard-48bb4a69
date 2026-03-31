CREATE OR REPLACE FUNCTION public.validate_boleto_message_log_rule_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.message_type = 'boleto' AND NEW.rule_id IS NULL THEN
    RAISE EXCEPTION 'rule_id is required for boleto message_log entries';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_boleto_rule_id
  BEFORE INSERT ON public.message_log
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_boleto_message_log_rule_id();