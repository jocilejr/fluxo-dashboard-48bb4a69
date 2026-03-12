-- Add global metrics columns to member_area_offers
ALTER TABLE public.member_area_offers 
  ADD COLUMN IF NOT EXISTS total_impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_clicks integer NOT NULL DEFAULT 0;