-- PROJECTS table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE DEFAULT ('PRJ-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4)),
  client_id UUID NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'rollout',
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  total_sites INTEGER NOT NULL DEFAULT 0,
  completed_sites INTEGER NOT NULL DEFAULT 0,
  total_devices INTEGER NOT NULL DEFAULT 0,
  deployed_devices INTEGER NOT NULL DEFAULT 0,
  budget NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  lead_user_id UUID,
  region_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage projects" ON public.projects FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage projects" ON public.projects FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role)) WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Coordinators view projects" ON public.projects FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'associate_coordinator'::app_role));
CREATE POLICY "Clients view own projects" ON public.projects FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SD-WAN SITES
CREATE TABLE public.sd_wan_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID,
  client_id UUID NOT NULL,
  site_name TEXT NOT NULL,
  site_code TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  vendor TEXT NOT NULL DEFAULT 'cisco',
  device_model TEXT,
  technology TEXT NOT NULL DEFAULT 'sd_wan',
  status TEXT NOT NULL DEFAULT 'planned',
  install_date DATE,
  go_live_date DATE,
  primary_circuit TEXT,
  secondary_circuit TEXT,
  sla_tier TEXT NOT NULL DEFAULT 'standard',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sd_wan_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sdwan sites" ON public.sd_wan_sites FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage sdwan sites" ON public.sd_wan_sites FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role)) WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Coordinators view sdwan sites" ON public.sd_wan_sites FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'associate_coordinator'::app_role));
CREATE POLICY "Clients view own sdwan sites" ON public.sd_wan_sites FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER trg_sdwan_updated BEFORE UPDATE ON public.sd_wan_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DATA CIRCUITS
CREATE TABLE public.data_circuits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  project_id UUID,
  site_name TEXT NOT NULL,
  circuit_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  circuit_type TEXT NOT NULL DEFAULT 'mpls',
  bandwidth_mbps INTEGER,
  install_date DATE,
  contract_end_date DATE,
  monthly_cost NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active',
  ip_block TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_circuits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage circuits" ON public.data_circuits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage circuits" ON public.data_circuits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role)) WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Coordinators view circuits" ON public.data_circuits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'associate_coordinator'::app_role));
CREATE POLICY "Clients view own circuits" ON public.data_circuits FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER trg_circuits_updated BEFORE UPDATE ON public.data_circuits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_sdwan_client ON public.sd_wan_sites(client_id);
CREATE INDEX idx_sdwan_project ON public.sd_wan_sites(project_id);
CREATE INDEX idx_circuits_client ON public.data_circuits(client_id);
CREATE INDEX idx_circuits_project ON public.data_circuits(project_id);