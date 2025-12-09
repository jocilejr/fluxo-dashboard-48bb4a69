-- Add DELETE policy for delivery_link_generations table
CREATE POLICY "Users can delete link generations"
ON public.delivery_link_generations
FOR DELETE
USING (auth.uid() IS NOT NULL);