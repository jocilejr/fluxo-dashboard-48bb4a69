-- Add name column to identify each Meta Ads account
ALTER TABLE public.meta_ads_settings 
ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Conta Principal';

-- Add is_active column to enable/disable accounts
ALTER TABLE public.meta_ads_settings 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;