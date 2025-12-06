-- Add value column to delivery_products for pixel tracking
ALTER TABLE public.delivery_products 
ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0;