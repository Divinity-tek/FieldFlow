
CREATE TABLE IF NOT EXISTS public.teams_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'microsoft_teams',
  teams_team_id TEXT,
  teams_channel_id TEXT,
  teams_message_id TEXT,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  body TEXT,
  service_category TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  raw_payload JSONB,
  matched_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  matched_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  routed_team_id UUID REFERENCES public.service_desk_teams(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processed|failed|skipped
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_inquiries_message
  ON public.teams_inquiries(teams_message_id) WHERE teams_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_inquiries_status ON public.teams_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_teams_inquiries_created ON public.teams_inquiries(created_at DESC);

ALTER TABLE public.teams_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service desk staff can view inquiries"
  ON public.teams_inquiries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'team_lead'::app_role)
    OR public.has_role(auth.uid(), 'service_desk'::app_role)
    OR public.has_role(auth.uid(), 'associate_coordinator'::app_role)
  );

CREATE POLICY "Service desk staff can manage inquiries"
  ON public.teams_inquiries FOR ALL TO authenticated
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

CREATE TRIGGER trg_teams_inquiries_updated
BEFORE UPDATE ON public.teams_inquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
