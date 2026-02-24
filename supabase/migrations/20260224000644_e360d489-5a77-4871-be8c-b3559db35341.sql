
-- Create browser_sessions table for persistent web browser sessions
CREATE TABLE public.browser_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  favicon TEXT,
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.browser_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own browser sessions"
ON public.browser_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own browser sessions"
ON public.browser_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own browser sessions"
ON public.browser_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own browser sessions"
ON public.browser_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_browser_sessions_updated_at
BEFORE UPDATE ON public.browser_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast user lookups
CREATE INDEX idx_browser_sessions_user_id ON public.browser_sessions(user_id);
CREATE INDEX idx_browser_sessions_last_accessed ON public.browser_sessions(user_id, last_accessed_at DESC);
