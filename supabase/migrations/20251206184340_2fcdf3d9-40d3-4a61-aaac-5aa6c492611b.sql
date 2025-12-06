-- Create table for useful links
CREATE TABLE public.useful_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  icon text DEFAULT 'link',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.useful_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage useful links
CREATE POLICY "Admins can manage useful links"
ON public.useful_links
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view active links
CREATE POLICY "Users can view useful links"
ON public.useful_links
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_useful_links_updated_at
BEFORE UPDATE ON public.useful_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();