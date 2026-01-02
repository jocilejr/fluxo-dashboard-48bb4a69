-- Create table to cache phone validations from Evolution API
CREATE TABLE public.phone_validations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  normalized_phone text NOT NULL UNIQUE,
  exists_on_whatsapp boolean NOT NULL DEFAULT false,
  jid text,
  is_mobile boolean,
  validated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_validations ENABLE ROW LEVEL SECURITY;

-- Users can view phone validations
CREATE POLICY "Users can view phone validations" 
ON public.phone_validations 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Service role can manage (for edge functions)
CREATE POLICY "Service role can manage phone validations" 
ON public.phone_validations 
FOR ALL
USING (true)
WITH CHECK (true);

-- Users can insert phone validations
CREATE POLICY "Users can insert phone validations" 
ON public.phone_validations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Index for fast lookup
CREATE INDEX idx_phone_validations_phone ON public.phone_validations(normalized_phone);