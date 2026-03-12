
-- Atomic function to increment offer impressions (callable by anon)
CREATE OR REPLACE FUNCTION public.increment_offer_impression(offer_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE member_area_offers
  SET total_impressions = total_impressions + 1
  WHERE id = offer_id;
$$;

-- Atomic function to increment offer clicks (callable by anon)
CREATE OR REPLACE FUNCTION public.increment_offer_click(offer_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE member_area_offers
  SET total_clicks = total_clicks + 1
  WHERE id = offer_id;
$$;
