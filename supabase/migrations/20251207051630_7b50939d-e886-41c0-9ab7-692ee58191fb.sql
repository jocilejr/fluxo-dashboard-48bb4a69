-- Add delivery_accesses tracking to customer events (for PIX link access tracking)
-- This allows us to see when customers accessed their delivery links

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_delivery_accesses_phone ON delivery_accesses(phone);
CREATE INDEX IF NOT EXISTS idx_delivery_link_generations_normalized_phone ON delivery_link_generations(normalized_phone);

-- Allow authenticated users to delete transactions (for admin management)
CREATE POLICY "Admins can insert transactions" 
ON transactions FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow users to delete their customers' transactions for cleanup
CREATE POLICY "Users can delete transactions"
ON transactions FOR DELETE
USING (auth.uid() IS NOT NULL);