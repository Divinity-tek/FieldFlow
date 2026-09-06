
-- 1. Recurring Job Templates
CREATE TABLE public.recurring_job_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  service_type TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  description TEXT,
  priority public.job_priority NOT NULL DEFAULT 'medium',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  template_data JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_job_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recurring templates" ON public.recurring_job_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage recurring templates" ON public.recurring_job_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Authenticated can view recurring templates" ON public.recurring_job_templates FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_recurring_job_templates_updated_at BEFORE UPDATE ON public.recurring_job_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Client Assets
CREATE TABLE public.client_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'equipment',
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  install_date DATE,
  warranty_expiry DATE,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assets" ON public.client_assets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage assets" ON public.client_assets FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Clients can view own assets" ON public.client_assets FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated can view assets" ON public.client_assets FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_client_assets_updated_at BEFORE UPDATE ON public.client_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Asset Service History
CREATE TABLE public.asset_service_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.client_assets(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL DEFAULT 'maintenance',
  description TEXT,
  next_service_due DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_service_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage asset history" ON public.asset_service_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage asset history" ON public.asset_service_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Authenticated can view asset history" ON public.asset_service_history FOR SELECT TO authenticated USING (true);

-- 4. Voice Notes
CREATE TABLE public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL,
  audio_url TEXT,
  transcript TEXT,
  ai_summary TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage voice notes" ON public.voice_notes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage voice notes" ON public.voice_notes FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Engineers can manage own voice notes" ON public.voice_notes FOR ALL TO authenticated USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated can view voice notes" ON public.voice_notes FOR SELECT TO authenticated USING (true);

-- 5. Digital Signature columns on estimates and invoices
ALTER TABLE public.estimates ADD COLUMN signature_data TEXT;
ALTER TABLE public.estimates ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.estimates ADD COLUMN signed_by TEXT;

ALTER TABLE public.invoices ADD COLUMN signature_data TEXT;
ALTER TABLE public.invoices ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN signed_by TEXT;
