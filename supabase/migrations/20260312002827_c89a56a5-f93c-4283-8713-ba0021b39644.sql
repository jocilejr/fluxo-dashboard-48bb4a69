CREATE TABLE public.product_knowledge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  key_topics text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.product_knowledge_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read knowledge summaries"
  ON public.product_knowledge_summaries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage knowledge summaries"
  ON public.product_knowledge_summaries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);