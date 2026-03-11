ALTER TABLE public.member_product_materials ADD COLUMN button_label text DEFAULT NULL;

ALTER TABLE public.member_area_settings ADD COLUMN layout_order jsonb DEFAULT '["greeting","content","verse","offers"]'::jsonb;