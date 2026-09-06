
-- ============= CERTIFICATION TYPES (catalog) =============
CREATE TABLE public.certification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'certification',
  issuer TEXT,
  description TEXT,
  requires_expiry BOOLEAN NOT NULL DEFAULT true,
  default_validity_months INTEGER DEFAULT 12,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.certification_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active cert types"
  ON public.certification_types FOR SELECT
  TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage cert types"
  ON public.certification_types FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cert_types_updated
  BEFORE UPDATE ON public.certification_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= ENGINEER CERTIFICATIONS =============
CREATE TABLE public.engineer_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL,
  certification_type_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  issued_date DATE,
  expiry_date DATE,
  certificate_number TEXT,
  document_url TEXT,
  notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eng_certs_engineer ON public.engineer_certifications(engineer_id);
CREATE INDEX idx_eng_certs_status ON public.engineer_certifications(status);
CREATE INDEX idx_eng_certs_expiry ON public.engineer_certifications(expiry_date);

ALTER TABLE public.engineer_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view certifications"
  ON public.engineer_certifications FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Engineers manage own certifications"
  ON public.engineer_certifications FOR ALL
  TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()))
  WITH CHECK (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all certifications"
  ON public.engineer_certifications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leads manage certifications"
  ON public.engineer_certifications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));

CREATE TRIGGER trg_eng_certs_updated
  BEFORE UPDATE ON public.engineer_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= ENGINEER BACKOUTS =============
CREATE TABLE public.engineer_backouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL,
  job_id UUID,
  backout_type TEXT NOT NULL DEFAULT 'late',
  hours_before_scheduled NUMERIC,
  reason TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backouts_engineer ON public.engineer_backouts(engineer_id);
CREATE INDEX idx_backouts_created ON public.engineer_backouts(created_at DESC);

ALTER TABLE public.engineer_backouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers view own backouts"
  ON public.engineer_backouts FOR SELECT
  TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all backouts"
  ON public.engineer_backouts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leads manage backouts"
  ON public.engineer_backouts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));

-- ============= ENGINEER CHECK-INS (timeliness) =============
CREATE TABLE public.engineer_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL,
  job_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL,
  delta_minutes INTEGER NOT NULL,
  timeliness_category TEXT NOT NULL DEFAULT 'on_time',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkins_engineer ON public.engineer_checkins(engineer_id);
CREATE INDEX idx_checkins_created ON public.engineer_checkins(created_at DESC);

ALTER TABLE public.engineer_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers view own checkins"
  ON public.engineer_checkins FOR SELECT
  TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all checkins"
  ON public.engineer_checkins FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leads manage checkins"
  ON public.engineer_checkins FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));

-- ============= ENGINEER SUCCESS SCORES =============
CREATE TABLE public.engineer_success_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL UNIQUE,
  success_score NUMERIC NOT NULL DEFAULT 0,
  timeliness_score NUMERIC NOT NULL DEFAULT 0,
  backout_score NUMERIC NOT NULL DEFAULT 100,
  buyer_satisfaction_score NUMERIC NOT NULL DEFAULT 0,
  total_assignments INTEGER NOT NULL DEFAULT 0,
  on_time_count INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  early_backout_count INTEGER NOT NULL DEFAULT 0,
  late_backout_count INTEGER NOT NULL DEFAULT 0,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze',
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scores_score ON public.engineer_success_scores(success_score DESC);
CREATE INDEX idx_scores_tier ON public.engineer_success_scores(tier);

ALTER TABLE public.engineer_success_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view success scores"
  ON public.engineer_success_scores FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage success scores"
  ON public.engineer_success_scores FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leads manage success scores"
  ON public.engineer_success_scores FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));

CREATE TRIGGER trg_scores_updated
  BEFORE UPDATE ON public.engineer_success_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= RECOMPUTE FUNCTION =============
CREATE OR REPLACE FUNCTION public.recompute_engineer_success_score(_engineer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_on_time INT;
  v_late INT;
  v_early_backout INT;
  v_late_backout INT;
  v_no_show INT;
  v_avg_rating NUMERIC;
  v_rating_count INT;
  v_timeliness NUMERIC;
  v_backout NUMERIC;
  v_satisfaction NUMERIC;
  v_success NUMERIC;
  v_tier TEXT;
BEGIN
  SELECT COUNT(*) FILTER (WHERE timeliness_category IN ('on_time','too_early')),
         COUNT(*) FILTER (WHERE timeliness_category = 'late'),
         COUNT(*)
    INTO v_on_time, v_late, v_total
    FROM public.engineer_checkins
   WHERE engineer_id = _engineer_id
     AND created_at >= now() - interval '90 days';

  SELECT COUNT(*) FILTER (WHERE backout_type = 'early'),
         COUNT(*) FILTER (WHERE backout_type = 'late'),
         COUNT(*) FILTER (WHERE backout_type = 'no_show')
    INTO v_early_backout, v_late_backout, v_no_show
    FROM public.engineer_backouts
   WHERE engineer_id = _engineer_id
     AND created_at >= now() - interval '90 days';

  SELECT COALESCE(AVG(rating), 0), COUNT(*)
    INTO v_avg_rating, v_rating_count
    FROM public.engineer_ratings
   WHERE engineer_id = _engineer_id
     AND created_at >= now() - interval '180 days';

  v_timeliness := CASE WHEN v_total = 0 THEN 0 ELSE ROUND((v_on_time::numeric / v_total) * 100, 1) END;

  v_backout := GREATEST(0, 100 - (v_early_backout * 5) - (v_late_backout * 15) - (v_no_show * 30));

  v_satisfaction := ROUND((COALESCE(v_avg_rating, 0) / 5.0) * 100, 1);

  v_success := ROUND((v_timeliness * 0.30) + (v_backout * 0.30) + (v_satisfaction * 0.40), 1);

  v_tier := CASE
    WHEN v_success >= 90 THEN 'platinum'
    WHEN v_success >= 75 THEN 'gold'
    WHEN v_success >= 60 THEN 'silver'
    ELSE 'bronze'
  END;

  INSERT INTO public.engineer_success_scores (
    engineer_id, success_score, timeliness_score, backout_score, buyer_satisfaction_score,
    total_assignments, on_time_count, late_count,
    early_backout_count, late_backout_count, no_show_count,
    avg_rating, rating_count, tier, last_calculated_at
  ) VALUES (
    _engineer_id, v_success, v_timeliness, v_backout, v_satisfaction,
    v_total, v_on_time, v_late,
    v_early_backout, v_late_backout, v_no_show,
    ROUND(v_avg_rating, 2), v_rating_count, v_tier, now()
  )
  ON CONFLICT (engineer_id) DO UPDATE SET
    success_score = EXCLUDED.success_score,
    timeliness_score = EXCLUDED.timeliness_score,
    backout_score = EXCLUDED.backout_score,
    buyer_satisfaction_score = EXCLUDED.buyer_satisfaction_score,
    total_assignments = EXCLUDED.total_assignments,
    on_time_count = EXCLUDED.on_time_count,
    late_count = EXCLUDED.late_count,
    early_backout_count = EXCLUDED.early_backout_count,
    late_backout_count = EXCLUDED.late_backout_count,
    no_show_count = EXCLUDED.no_show_count,
    avg_rating = EXCLUDED.avg_rating,
    rating_count = EXCLUDED.rating_count,
    tier = EXCLUDED.tier,
    last_calculated_at = now(),
    updated_at = now();
END;
$$;

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('certification-documents', 'certification-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Engineers upload own cert documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certification-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Engineers view own cert documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'certification-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'team_lead'::app_role)
    )
  );

CREATE POLICY "Engineers update own cert documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'certification-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Engineers delete own cert documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'certification-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============= SEED CERTIFICATION CATALOG =============
INSERT INTO public.certification_types (code, name, category, issuer, description, requires_expiry, default_validity_months, icon) VALUES
('background_check', 'Background Check', 'screening', 'Checkr', 'Criminal background screening', true, 12, 'ShieldCheck'),
('drug_test', 'Drug Test', 'screening', 'Checkr', 'Pre-employment drug screening', true, 12, 'TestTube'),
('w9', 'W-9 Tax Form', 'tax', 'IRS', 'US contractor tax form', true, 36, 'FileText'),
('coi', 'Certificate of Insurance', 'insurance', 'Provider', 'General liability + workers comp', true, 12, 'Shield'),
('osha_10', 'OSHA-10', 'safety', 'OSHA', '10-hour construction safety', false, NULL, 'HardHat'),
('osha_30', 'OSHA-30', 'safety', 'OSHA', '30-hour construction safety', false, NULL, 'HardHat'),
('bicsi_tech', 'BICSI Technician', 'cabling', 'BICSI', 'Structured cabling technician', true, 36, 'Cable'),
('bicsi_installer', 'BICSI Installer 2', 'cabling', 'BICSI', 'Copper/fiber installer', true, 36, 'Cable'),
('comptia_a', 'CompTIA A+', 'it', 'CompTIA', 'IT hardware fundamentals', true, 36, 'Cpu'),
('comptia_network', 'CompTIA Network+', 'it', 'CompTIA', 'Networking fundamentals', true, 36, 'Network'),
('comptia_security', 'CompTIA Security+', 'it', 'CompTIA', 'Security fundamentals', true, 36, 'Lock'),
('cisco_ccna', 'Cisco CCNA', 'networking', 'Cisco', 'Cisco Certified Network Associate', true, 36, 'Router'),
('cisco_ccnp', 'Cisco CCNP', 'networking', 'Cisco', 'Cisco Certified Network Professional', true, 36, 'Router'),
('fortinet_nse4', 'Fortinet NSE 4', 'networking', 'Fortinet', 'Network security professional', true, 24, 'Shield'),
('aruba_acsa', 'Aruba ACSA', 'networking', 'HPE Aruba', 'Switching associate', true, 36, 'Wifi'),
('meraki_cmna', 'Meraki CMNA', 'networking', 'Cisco Meraki', 'Cloud networking associate', true, 24, 'Cloud'),
('avixa_cts', 'AVIXA CTS', 'av', 'AVIXA', 'Certified Technology Specialist', true, 36, 'Monitor'),
('low_voltage_license', 'Low Voltage License', 'license', 'State', 'State-issued low voltage license', true, 24, 'Zap'),
('drivers_license', 'Driver License', 'license', 'State DMV', 'Valid driver license', true, 60, 'Car');
