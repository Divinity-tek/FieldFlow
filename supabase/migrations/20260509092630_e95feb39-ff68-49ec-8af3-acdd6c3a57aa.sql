
-- Routing rules for inquiries coming from Microsoft Teams (or any inbound channel)
-- to the appropriate service desk team based on service category and location.

CREATE TABLE IF NOT EXISTS public.service_desk_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  teams_team_id TEXT,
  teams_channel_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_desk_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  service_category TEXT,           -- NULL = matches any category
  country TEXT,                    -- NULL = matches any country
  region TEXT,                     -- NULL = matches any region
  city TEXT,                       -- NULL = matches any city
  priority INTEGER NOT NULL DEFAULT 100, -- lower = evaluated first
  service_desk_team_id UUID NOT NULL REFERENCES public.service_desk_teams(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON public.service_desk_routing_rules(priority) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_routing_rules_category ON public.service_desk_routing_rules(service_category);

ALTER TABLE public.service_desk_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_desk_routing_rules ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view; only admin/team_lead/service_desk can manage
CREATE POLICY "Authenticated users can view service desk teams"
  ON public.service_desk_teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/leads can manage service desk teams"
  ON public.service_desk_teams FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'team_lead'::app_role)
    OR public.has_role(auth.uid(), 'service_desk'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'team_lead'::app_role)
    OR public.has_role(auth.uid(), 'service_desk'::app_role)
  );

CREATE POLICY "Authenticated users can view routing rules"
  ON public.service_desk_routing_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/leads can manage routing rules"
  ON public.service_desk_routing_rules FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'team_lead'::app_role)
    OR public.has_role(auth.uid(), 'service_desk'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'team_lead'::app_role)
    OR public.has_role(auth.uid(), 'service_desk'::app_role)
  );

CREATE TRIGGER trg_service_desk_teams_updated
BEFORE UPDATE ON public.service_desk_teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_routing_rules_updated
BEFORE UPDATE ON public.service_desk_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolver function: given a category + location, return the best-matching team.
-- Specificity is computed by how many filters in the rule are non-null and match.
CREATE OR REPLACE FUNCTION public.resolve_service_desk_team(
  _service_category TEXT,
  _country TEXT,
  _region TEXT,
  _city TEXT
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.service_desk_team_id
  FROM public.service_desk_routing_rules r
  JOIN public.service_desk_teams t ON t.id = r.service_desk_team_id
  WHERE r.is_active = TRUE
    AND t.is_active = TRUE
    AND (r.service_category IS NULL OR r.service_category = _service_category)
    AND (r.country IS NULL OR r.country = _country)
    AND (r.region  IS NULL OR r.region  = _region)
    AND (r.city    IS NULL OR r.city    = _city)
  ORDER BY
    -- More specific (fewer NULL filters) wins, then priority, then newest
    ((CASE WHEN r.service_category IS NULL THEN 0 ELSE 1 END)
   + (CASE WHEN r.country IS NULL THEN 0 ELSE 1 END)
   + (CASE WHEN r.region  IS NULL THEN 0 ELSE 1 END)
   + (CASE WHEN r.city    IS NULL THEN 0 ELSE 1 END)) DESC,
    r.priority ASC,
    r.created_at DESC
  LIMIT 1;
$$;
