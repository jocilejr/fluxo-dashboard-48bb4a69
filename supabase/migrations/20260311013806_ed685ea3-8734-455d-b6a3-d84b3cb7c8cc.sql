
-- Create member_product_categories table
CREATE TABLE public.member_product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📖',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.member_product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read member_product_categories" ON public.member_product_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage member_product_categories" ON public.member_product_categories
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create member_product_materials table
CREATE TABLE public.member_product_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.member_product_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'text',
  content_url TEXT,
  content_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.member_product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read member_product_materials" ON public.member_product_materials
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage member_product_materials" ON public.member_product_materials
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add category_tag to member_area_offers
ALTER TABLE public.member_area_offers ADD COLUMN category_tag TEXT;

-- Create member-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('member-files', 'member-files', true);

-- Storage RLS policies
CREATE POLICY "Anyone can read member files" ON storage.objects
  FOR SELECT USING (bucket_id = 'member-files');

CREATE POLICY "Admins can upload member files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'member-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete member files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'member-files' AND public.has_role(auth.uid(), 'admin'));
