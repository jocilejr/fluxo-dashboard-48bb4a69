
-- Create member_pixel_frames table
CREATE TABLE public.member_pixel_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  product_id uuid REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  product_value numeric NOT NULL DEFAULT 0,
  fired boolean NOT NULL DEFAULT false,
  fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_member_pixel_frames_phone_fired ON public.member_pixel_frames (normalized_phone, fired);

-- Enable RLS
ALTER TABLE public.member_pixel_frames ENABLE ROW LEVEL SECURITY;

-- Public read/write for anon+authenticated (needed for public member area)
CREATE POLICY "Public can read write member_pixel_frames"
  ON public.member_pixel_frames
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger function to auto-create pixel frame on member_products insert
CREATE OR REPLACE FUNCTION public.create_pixel_frame_on_member_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p_name text;
  p_value numeric;
BEGIN
  SELECT name, COALESCE(value, 0)
  INTO p_name, p_value
  FROM delivery_products
  WHERE id = NEW.product_id;

  IF p_name IS NOT NULL THEN
    INSERT INTO member_pixel_frames (normalized_phone, product_id, product_name, product_value)
    VALUES (NEW.normalized_phone, NEW.product_id, p_name, p_value);
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_create_pixel_frame_on_member_product
  AFTER INSERT ON public.member_products
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pixel_frame_on_member_product();
