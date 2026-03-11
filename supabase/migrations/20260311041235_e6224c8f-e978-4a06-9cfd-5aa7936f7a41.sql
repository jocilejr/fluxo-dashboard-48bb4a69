
-- Add product_id reference and make purchase_url nullable
ALTER TABLE public.member_area_offers 
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.delivery_products(id) ON DELETE SET NULL;

ALTER TABLE public.member_area_offers 
  ALTER COLUMN purchase_url DROP NOT NULL,
  ALTER COLUMN purchase_url SET DEFAULT '';
