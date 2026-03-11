
CREATE TABLE public.daily_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number integer NOT NULL UNIQUE,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_prayers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read daily_prayers" ON public.daily_prayers
  FOR SELECT TO anon, authenticated
  USING (true);
