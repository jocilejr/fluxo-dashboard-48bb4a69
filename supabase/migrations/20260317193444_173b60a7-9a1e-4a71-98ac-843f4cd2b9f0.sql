CREATE POLICY "Anon can view active global pixels"
ON public.global_delivery_pixels
FOR SELECT
TO anon
USING (is_active = true);