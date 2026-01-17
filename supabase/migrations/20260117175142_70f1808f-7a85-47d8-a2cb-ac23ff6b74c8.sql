-- Create quick_responses table
CREATE TABLE public.quick_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quick_responses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all quick responses" 
ON public.quick_responses 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create quick responses" 
ON public.quick_responses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quick responses" 
ON public.quick_responses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quick responses" 
ON public.quick_responses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_quick_responses_updated_at
BEFORE UPDATE ON public.quick_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();