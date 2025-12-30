-- Add global redirect URL to delivery_settings
ALTER TABLE public.delivery_settings 
ADD COLUMN global_redirect_url text;