-- Create engineer rate card table
CREATE TABLE public.engineer_rate_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'L1',
  level_name TEXT NOT NULL DEFAULT 'Basic Support',
  scope_of_work TEXT NOT NULL DEFAULT '',
  scope_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_hours NUMERIC NOT NULL DEFAULT 2,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  travel_rate NUMERIC NOT NULL DEFAULT 0,
  overtime_rate NUMERIC NOT NULL DEFAULT 0,
  emergency_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.engineer_rate_cards ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage rate cards"
ON public.engineer_rate_cards FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Team leads can manage
CREATE POLICY "Team leads can manage rate cards"
ON public.engineer_rate_cards FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'team_lead'::app_role));

-- Engineers can view
CREATE POLICY "Engineers can view rate cards"
ON public.engineer_rate_cards FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'engineer'::app_role));

-- Coordinators can view
CREATE POLICY "Coordinators can view rate cards"
ON public.engineer_rate_cards FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_rate_cards_updated_at
BEFORE UPDATE ON public.engineer_rate_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();