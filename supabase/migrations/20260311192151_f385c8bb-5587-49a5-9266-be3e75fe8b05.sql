
-- Fix storage UPDATE policy to include explicit WITH CHECK
DROP POLICY IF EXISTS "Authenticated users can update member files" ON storage.objects;
CREATE POLICY "Authenticated users can update member files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'member-files')
  WITH CHECK (bucket_id = 'member-files');

-- Also fix member_product_materials UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update member_product_materials" ON public.member_product_materials;
CREATE POLICY "Authenticated users can update member_product_materials"
  ON public.member_product_materials FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
