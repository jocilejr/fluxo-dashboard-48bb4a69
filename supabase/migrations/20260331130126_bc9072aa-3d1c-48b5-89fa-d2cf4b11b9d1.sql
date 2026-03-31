CREATE POLICY "Authenticated users can delete transactions"
ON public.transactions
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);