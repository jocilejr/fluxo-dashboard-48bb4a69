-- Create table to store OpenAI settings
CREATE TABLE public.openai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.openai_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read (admin only in practice since this is in settings)
CREATE POLICY "Authenticated users can read openai settings" 
ON public.openai_settings 
FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can insert
CREATE POLICY "Authenticated users can insert openai settings" 
ON public.openai_settings 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Only authenticated users can update
CREATE POLICY "Authenticated users can update openai settings" 
ON public.openai_settings 
FOR UPDATE 
TO authenticated 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_openai_settings_updated_at
BEFORE UPDATE ON public.openai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();