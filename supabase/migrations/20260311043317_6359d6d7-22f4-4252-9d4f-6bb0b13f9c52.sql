
-- Add public read policy for delivery_products (needed for member area public page)
CREATE POLICY "Public can read delivery_products"
ON public.delivery_products
FOR SELECT
TO anon
USING (true);

-- Add public read policy for customers (needed for member area greeting)
CREATE POLICY "Public can read customers for member area"
ON public.customers
FOR SELECT
TO anon
USING (true);
