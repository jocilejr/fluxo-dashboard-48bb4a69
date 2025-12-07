-- Allow authenticated users to insert customers
CREATE POLICY "Users can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update customers
CREATE POLICY "Users can update customers" 
ON public.customers 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);