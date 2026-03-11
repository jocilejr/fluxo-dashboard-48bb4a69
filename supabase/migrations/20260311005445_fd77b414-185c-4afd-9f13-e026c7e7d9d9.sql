
-- Table: member_products (links phone to delivery_products)
CREATE TABLE public.member_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  normalized_phone text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(normalized_phone, product_id)
);

ALTER TABLE public.member_products ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage member_products" ON public.member_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public read via edge function / anon
CREATE POLICY "Public can read member_products" ON public.member_products
  FOR SELECT TO anon, authenticated
  USING (true);

-- Table: member_area_settings
CREATE TABLE public.member_area_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT 'Área de Membros',
  logo_url text,
  welcome_message text DEFAULT 'Bem-vinda à sua área exclusiva! 🎉',
  theme_color text DEFAULT '#8B5CF6',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.member_area_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage member_area_settings" ON public.member_area_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read member_area_settings" ON public.member_area_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Table: member_area_offers
CREATE TABLE public.member_area_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text,
  purchase_url text NOT NULL,
  price numeric,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.member_area_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage member_area_offers" ON public.member_area_offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read active member_area_offers" ON public.member_area_offers
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Triggers for updated_at
CREATE TRIGGER update_member_products_updated_at BEFORE UPDATE ON public.member_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_area_settings_updated_at BEFORE UPDATE ON public.member_area_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_area_offers_updated_at BEFORE UPDATE ON public.member_area_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
