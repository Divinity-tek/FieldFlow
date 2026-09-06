
-- Create help_tooltips table for contextual help across the platform
CREATE TABLE public.help_tooltips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_route TEXT NOT NULL,
  element_key TEXT NOT NULL,
  tooltip_text TEXT,
  hint_text TEXT,
  help_article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE SET NULL,
  display_type TEXT NOT NULL DEFAULT 'tooltip',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_route, element_key)
);

-- Enable RLS
ALTER TABLE public.help_tooltips ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read tooltips
CREATE POLICY "Authenticated users can view tooltips"
ON public.help_tooltips
FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can manage tooltips
CREATE POLICY "Admins can manage tooltips"
ON public.help_tooltips
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Team leads can manage tooltips
CREATE POLICY "Team leads can manage tooltips"
ON public.help_tooltips
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'team_lead'));

-- Updated_at trigger
CREATE TRIGGER update_help_tooltips_updated_at
BEFORE UPDATE ON public.help_tooltips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
