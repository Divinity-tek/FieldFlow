-- Marketplace listings: jobs published to engineer marketplace for browse + apply/counter-offer
CREATE TABLE public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  posted_by UUID,
  visibility TEXT NOT NULL DEFAULT 'public', -- public | private | invite_only
  posted_pay NUMERIC,
  pay_negotiable BOOLEAN NOT NULL DEFAULT true,
  required_certifications TEXT[] NOT NULL DEFAULT '{}',
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open', -- open | filled | closed | expired
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

CREATE INDEX idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_job ON public.marketplace_listings(job_id);

-- Engineer applications + counter-offers for marketplace listings
CREATE TABLE public.marketplace_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL DEFAULT 'apply', -- apply | counter_offer
  proposed_pay NUMERIC,
  proposed_start_at TIMESTAMPTZ,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | withdrawn | countered
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(listing_id, engineer_id)
);

CREATE INDEX idx_mp_apps_listing ON public.marketplace_applications(listing_id);
CREATE INDEX idx_mp_apps_engineer ON public.marketplace_applications(engineer_id);
CREATE INDEX idx_mp_apps_status ON public.marketplace_applications(status);

-- updated_at triggers
CREATE TRIGGER trg_marketplace_listings_updated BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketplace_applications_updated BEFORE UPDATE ON public.marketplace_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_applications ENABLE ROW LEVEL SECURITY;

-- Listings: anyone authenticated can view open public listings; admins/team_lead manage all
CREATE POLICY "View open listings" ON public.marketplace_listings
  FOR SELECT TO authenticated
  USING (
    status = 'open' AND visibility = 'public'
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'associate_coordinator')
  );

CREATE POLICY "Admins manage listings" ON public.marketplace_listings
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'associate_coordinator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'associate_coordinator')
  );

-- Applications: engineers see/manage their own; admins/team_lead see all
CREATE POLICY "Engineers view own apps" ON public.marketplace_applications
  FOR SELECT TO authenticated
  USING (
    engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'associate_coordinator')
  );

CREATE POLICY "Engineers create own apps" ON public.marketplace_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  );

CREATE POLICY "Engineers update own pending apps" ON public.marketplace_applications
  FOR UPDATE TO authenticated
  USING (
    engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "Admins manage apps" ON public.marketplace_applications
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'associate_coordinator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'associate_coordinator')
  );

-- Accept-application function: assigns the engineer to the job, marks listing filled, rejects others
CREATE OR REPLACE FUNCTION public.accept_marketplace_application(_application_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_eng RECORD;
BEGIN
  SELECT * INTO v_app FROM public.marketplace_applications WHERE id = _application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  SELECT * INTO v_eng FROM public.engineers WHERE id = v_app.engineer_id;

  -- Assign engineer to job
  UPDATE public.jobs
     SET engineer_id = v_app.engineer_id,
         status = 'assigned',
         engineer_charge = COALESCE(v_app.proposed_pay, engineer_charge),
         scheduled_at = COALESCE(v_app.proposed_start_at, scheduled_at),
         assigned_by = auth.uid(),
         updated_at = now()
   WHERE id = v_app.job_id;

  -- Mark listing filled
  UPDATE public.marketplace_listings
     SET status = 'filled', updated_at = now()
   WHERE id = v_app.listing_id;

  -- Accept this app
  UPDATE public.marketplace_applications
     SET status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   WHERE id = _application_id;

  -- Reject other pending apps on same listing
  UPDATE public.marketplace_applications
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now(),
         review_note = COALESCE(review_note, 'Position filled by another applicant')
   WHERE listing_id = v_app.listing_id
     AND id != _application_id
     AND status = 'pending';

  -- Notify accepted engineer
  IF v_eng.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      v_eng.user_id,
      'Application accepted',
      'Your marketplace application has been accepted. The job is now assigned to you.',
      'marketplace',
      jsonb_build_object('job_id', v_app.job_id, 'application_id', _application_id)
    );
  END IF;
END;
$$;

-- Reject-application function
CREATE OR REPLACE FUNCTION public.reject_marketplace_application(_application_id UUID, _note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_eng RECORD;
BEGIN
  SELECT * INTO v_app FROM public.marketplace_applications WHERE id = _application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  SELECT * INTO v_eng FROM public.engineers WHERE id = v_app.engineer_id;

  UPDATE public.marketplace_applications
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = _note, updated_at = now()
   WHERE id = _application_id;

  IF v_eng.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      v_eng.user_id,
      'Application not selected',
      COALESCE(_note, 'Your marketplace application was not selected for this job.'),
      'marketplace',
      jsonb_build_object('job_id', v_app.job_id, 'application_id', _application_id)
    );
  END IF;
END;
$$;