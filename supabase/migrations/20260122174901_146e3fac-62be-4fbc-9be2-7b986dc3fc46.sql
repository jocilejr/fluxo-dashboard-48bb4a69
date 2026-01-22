-- Create table for pixel fire logs
CREATE TABLE public.pixel_fire_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.delivery_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pixels_fired JSONB NOT NULL DEFAULT '[]',
  product_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pixel_fire_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all pixel logs
CREATE POLICY "Authenticated users can view pixel logs" 
ON public.pixel_fire_logs 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Policy: Allow insert from service role (edge functions)
CREATE POLICY "Service role can insert pixel logs" 
ON public.pixel_fire_logs 
FOR INSERT 
WITH CHECK (true);

-- Index for faster queries by date
CREATE INDEX idx_pixel_fire_logs_created_at ON public.pixel_fire_logs(created_at DESC);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_fire_logs;