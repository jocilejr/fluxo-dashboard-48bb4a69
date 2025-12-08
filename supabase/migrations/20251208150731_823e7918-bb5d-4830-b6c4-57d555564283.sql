-- Create table to store Meta Ads configuration (admin only)
CREATE TABLE public.meta_ads_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_ads_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage Meta Ads settings
CREATE POLICY "Admins can view meta ads settings"
ON public.meta_ads_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert meta ads settings"
ON public.meta_ads_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update meta ads settings"
ON public.meta_ads_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete meta ads settings"
ON public.meta_ads_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_meta_ads_settings_updated_at
BEFORE UPDATE ON public.meta_ads_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();