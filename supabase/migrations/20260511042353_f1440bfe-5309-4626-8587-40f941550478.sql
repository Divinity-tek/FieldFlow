CREATE TABLE public.roi_funnel_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'estimate_savings_clicked',
    'questionnaire_viewed',
    'questionnaire_prefilled',
    'questionnaire_completed'
  )),
  service_level text,
  sla text,
  duration text,
  monthly_jobs integer,
  monthly_savings_usd integer,
  annual_savings_usd integer,
  savings_pct integer,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roi_funnel_events_session ON public.roi_funnel_events (session_id, created_at DESC);
CREATE INDEX idx_roi_funnel_events_type_created ON public.roi_funnel_events (event_type, created_at DESC);

ALTER TABLE public.roi_funnel_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous landing visitors) can record their own funnel events.
CREATE POLICY "Anyone can insert roi funnel events"
  ON public.roi_funnel_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins / team leads / service desk can read the funnel.
CREATE POLICY "Staff can read roi funnel events"
  ON public.roi_funnel_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'team_lead'::app_role)
    OR public.has_role(auth.uid(), 'service_desk'::app_role)
  );