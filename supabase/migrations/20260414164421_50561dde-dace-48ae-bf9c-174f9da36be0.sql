
-- Regions table
CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'UK',
  timezone text NOT NULL DEFAULT 'Europe/London',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage regions" ON public.regions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON public.regions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add region_id to engineers
ALTER TABLE public.engineers ADD COLUMN region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL;

-- Add region_id to jobs
ALTER TABLE public.jobs ADD COLUMN region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL;

-- SLA breaches table
CREATE TABLE public.sla_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sla_policy_id uuid NOT NULL REFERENCES public.sla_policies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  breach_type text NOT NULL DEFAULT 'response', -- 'response' or 'resolution'
  breached_at timestamptz NOT NULL DEFAULT now(),
  target_minutes integer NOT NULL,
  actual_minutes integer,
  escalation_status text NOT NULL DEFAULT 'pending', -- 'pending', 'notified', 'acknowledged', 'resolved'
  escalated_to uuid, -- user_id of team lead
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_breaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sla_breaches" ON public.sla_breaches FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can view sla_breaches" ON public.sla_breaches FOR SELECT USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Clients can view own sla_breaches" ON public.sla_breaches FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

CREATE TRIGGER update_sla_breaches_updated_at BEFORE UPDATE ON public.sla_breaches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pricing rules table
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  base_price numeric NOT NULL DEFAULT 0,
  urgency_multiplier_low numeric NOT NULL DEFAULT 1.0,
  urgency_multiplier_medium numeric NOT NULL DEFAULT 1.0,
  urgency_multiplier_high numeric NOT NULL DEFAULT 1.5,
  urgency_multiplier_urgent numeric NOT NULL DEFAULT 2.0,
  complexity_multiplier numeric NOT NULL DEFAULT 1.0,
  min_price numeric NOT NULL DEFAULT 0,
  max_price numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pricing_rules" ON public.pricing_rules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage pricing_rules" ON public.pricing_rules FOR ALL USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Authenticated can view pricing_rules" ON public.pricing_rules FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_engineers_region ON public.engineers(region_id);
CREATE INDEX idx_jobs_region ON public.jobs(region_id);
CREATE INDEX idx_sla_breaches_job ON public.sla_breaches(job_id);
CREATE INDEX idx_sla_breaches_client ON public.sla_breaches(client_id);
CREATE INDEX idx_sla_breaches_status ON public.sla_breaches(escalation_status);
CREATE INDEX idx_pricing_rules_service ON public.pricing_rules(service_type);
CREATE INDEX idx_pricing_rules_region ON public.pricing_rules(region_id);
