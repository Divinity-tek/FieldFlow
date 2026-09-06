
-- Dispatch lead inbox: stores public submissions from the landing-page
-- "Request dispatch availability + quote" form.
CREATE TABLE public.dispatch_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT,

  -- Site
  site_address TEXT NOT NULL,
  site_city TEXT NOT NULL,
  site_postal_code TEXT NOT NULL,
  site_country TEXT NOT NULL,
  site_contact TEXT,
  site_access_notes TEXT,

  -- Service level + SLA
  service_level TEXT NOT NULL CHECK (service_level IN ('L1','L2','L3')),
  sla TEXT NOT NULL,
  duration_estimate TEXT,
  preferred_date DATE NOT NULL,
  preferred_window TEXT NOT NULL,

  -- Scope
  scope TEXT NOT NULL,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','quoted','won','lost','spam')),
  assigned_to UUID,
  internal_notes TEXT,

  -- Audit
  source_url TEXT,
  user_agent TEXT,
  ip_address TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_leads_created_at ON public.dispatch_leads (created_at DESC);
CREATE INDEX idx_dispatch_leads_status ON public.dispatch_leads (status);

ALTER TABLE public.dispatch_leads ENABLE ROW LEVEL SECURITY;

-- Only admins, team_leads and service_desk staff can read / manage leads.
CREATE POLICY "Staff can view dispatch leads"
  ON public.dispatch_leads FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'service_desk')
  );

CREATE POLICY "Staff can update dispatch leads"
  ON public.dispatch_leads FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'service_desk')
  );

CREATE POLICY "Admins can delete dispatch leads"
  ON public.dispatch_leads FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- No public INSERT policy: inserts happen via the submit-dispatch-lead edge
-- function using the service role, which performs validation, rate limiting
-- and spam filtering.

CREATE TRIGGER update_dispatch_leads_updated_at
  BEFORE UPDATE ON public.dispatch_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configurable notification recipients (a single dispatch inbox by default).
CREATE TABLE public.dispatch_notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage dispatch recipients"
  ON public.dispatch_notification_recipients FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view dispatch recipients"
  ON public.dispatch_notification_recipients FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'service_desk')
  );

CREATE TRIGGER update_dispatch_recipients_updated_at
  BEFORE UPDATE ON public.dispatch_notification_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
