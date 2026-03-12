
CREATE TABLE public.member_offer_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  offer_id uuid NOT NULL REFERENCES public.member_area_offers(id) ON DELETE CASCADE,
  impression_count integer NOT NULL DEFAULT 0,
  clicked boolean NOT NULL DEFAULT false,
  last_shown_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (normalized_phone, offer_id)
);

ALTER TABLE public.member_offer_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read write member_offer_impressions"
ON public.member_offer_impressions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
