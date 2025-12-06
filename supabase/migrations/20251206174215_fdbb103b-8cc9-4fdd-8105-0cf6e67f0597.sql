-- Add redirect_url to delivery_products
ALTER TABLE public.delivery_products 
ADD COLUMN IF NOT EXISTS redirect_url text;

-- Create global delivery pixels table
CREATE TABLE IF NOT EXISTS public.global_delivery_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  pixel_id text NOT NULL,
  access_token text,
  event_name text DEFAULT 'Purchase',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_delivery_pixels ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage global pixels"
ON public.global_delivery_pixels
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Users can view
CREATE POLICY "Users can view global pixels"
ON public.global_delivery_pixels
FOR SELECT
USING (auth.uid() IS NOT NULL);