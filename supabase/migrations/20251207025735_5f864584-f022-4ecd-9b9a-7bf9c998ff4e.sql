-- Add pix_payment_count to customers table
ALTER TABLE public.customers 
ADD COLUMN pix_payment_count integer NOT NULL DEFAULT 0;

-- Create table to track delivery link generations
CREATE TABLE public.delivery_link_generations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  phone text NOT NULL,
  normalized_phone text NOT NULL,
  payment_method text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_link_generations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view link generations"
  ON public.delivery_link_generations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert link generations"
  ON public.delivery_link_generations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_delivery_link_generations_phone ON public.delivery_link_generations(normalized_phone);
CREATE INDEX idx_delivery_link_generations_product ON public.delivery_link_generations(product_id);