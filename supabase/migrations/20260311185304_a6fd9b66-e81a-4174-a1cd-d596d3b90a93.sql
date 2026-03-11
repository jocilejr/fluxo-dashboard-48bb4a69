
-- Allow authenticated users (collaborators) to manage member area tables

-- member_products: allow all authenticated users to insert, update, delete
CREATE POLICY "Authenticated users can insert member_products"
  ON public.member_products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update member_products"
  ON public.member_products FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete member_products"
  ON public.member_products FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- member_area_offers: allow all authenticated users to manage
CREATE POLICY "Authenticated users can insert member_area_offers"
  ON public.member_area_offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update member_area_offers"
  ON public.member_area_offers FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete member_area_offers"
  ON public.member_area_offers FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- member_product_materials: allow all authenticated users to manage
CREATE POLICY "Authenticated users can insert member_product_materials"
  ON public.member_product_materials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update member_product_materials"
  ON public.member_product_materials FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete member_product_materials"
  ON public.member_product_materials FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- member_product_categories: allow all authenticated users to manage
CREATE POLICY "Authenticated users can insert member_product_categories"
  ON public.member_product_categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update member_product_categories"
  ON public.member_product_categories FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete member_product_categories"
  ON public.member_product_categories FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- member_area_settings: allow all authenticated users to manage
CREATE POLICY "Authenticated users can insert member_area_settings"
  ON public.member_area_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update member_area_settings"
  ON public.member_area_settings FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);
