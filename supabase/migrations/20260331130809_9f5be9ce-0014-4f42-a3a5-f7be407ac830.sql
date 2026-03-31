ALTER TABLE public.message_log DROP CONSTRAINT IF EXISTS message_log_transaction_id_fkey;

ALTER TABLE public.message_log
ADD CONSTRAINT message_log_transaction_id_fkey
FOREIGN KEY (transaction_id)
REFERENCES public.transactions(id)
ON DELETE CASCADE;