
CREATE TABLE public.psalms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psalm_number integer NOT NULL,
  verse_number text NOT NULL,
  text text NOT NULL,
  reference text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.psalms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read psalms" ON public.psalms
  FOR SELECT TO anon, authenticated
  USING (true);
