
CREATE TABLE public.member_content_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  material_id uuid NOT NULL REFERENCES public.member_product_materials(id) ON DELETE CASCADE,
  progress_type text NOT NULL DEFAULT 'pdf',
  current_page integer DEFAULT 0,
  total_pages integer DEFAULT 0,
  video_seconds integer DEFAULT 0,
  video_duration integer DEFAULT 0,
  last_accessed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(normalized_phone, material_id)
);

ALTER TABLE public.member_content_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read write progress" ON public.member_content_progress
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
