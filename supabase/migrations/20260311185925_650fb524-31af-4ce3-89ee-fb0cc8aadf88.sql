
-- Allow all authenticated users to upload and delete member files
DROP POLICY "Admins can upload member files" ON storage.objects;
DROP POLICY "Admins can delete member files" ON storage.objects;

CREATE POLICY "Authenticated users can upload member files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-files');

CREATE POLICY "Authenticated users can delete member files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'member-files');

CREATE POLICY "Authenticated users can update member files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'member-files');
