
CREATE OR REPLACE FUNCTION public.current_engineer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.engineers WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE TABLE public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  engineer_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('travel_start','arrived','started','paused','resumed','completed','note')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  lat double precision,
  lng double precision,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_events_job ON public.job_events(job_id, occurred_at);
CREATE INDEX idx_job_events_engineer ON public.job_events(engineer_id, occurred_at DESC);
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engineers manage own job events" ON public.job_events
  FOR ALL TO authenticated
  USING (engineer_id = public.current_engineer_id() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (engineer_id = public.current_engineer_id() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.job_parts_used (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  engineer_id uuid NOT NULL,
  description text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit text DEFAULT 'each',
  unit_cost numeric(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_parts_job ON public.job_parts_used(job_id);
ALTER TABLE public.job_parts_used ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engineers manage own parts" ON public.job_parts_used
  FOR ALL TO authenticated
  USING (engineer_id = public.current_engineer_id() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (engineer_id = public.current_engineer_id() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.engineer_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id uuid NOT NULL,
  job_id uuid,
  vendor text,
  amount numeric(10,2),
  currency text DEFAULT 'GBP',
  occurred_on date,
  category text,
  receipt_path text,
  ocr_raw jsonb,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','approved','rejected','reimbursed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_engineer ON public.engineer_expenses(engineer_id, occurred_on DESC);
ALTER TABLE public.engineer_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engineers manage own expenses" ON public.engineer_expenses
  FOR ALL TO authenticated
  USING (engineer_id = public.current_engineer_id() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (engineer_id = public.current_engineer_id() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.engineer_sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id uuid NOT NULL,
  job_id uuid,
  lat double precision,
  lng double precision,
  note text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sos_engineer ON public.engineer_sos_events(engineer_id, created_at DESC);
ALTER TABLE public.engineer_sos_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engineers create own sos" ON public.engineer_sos_events
  FOR INSERT TO authenticated
  WITH CHECK (engineer_id = public.current_engineer_id());
CREATE POLICY "engineers view own sos" ON public.engineer_sos_events
  FOR SELECT TO authenticated
  USING (engineer_id = public.current_engineer_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage sos" ON public.engineer_sos_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_parts_updated BEFORE UPDATE ON public.job_parts_used
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.engineer_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES
  ('engineer-receipts','engineer-receipts',false),
  ('engineer-certifications','engineer-certifications',false),
  ('job-signatures','job-signatures',false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "eng read own receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'engineer-receipts' AND (
    (storage.foldername(name))[1] = public.current_engineer_id()::text
    OR public.has_role(auth.uid(),'admin')
  ));
CREATE POLICY "eng write own receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'engineer-receipts' AND (storage.foldername(name))[1] = public.current_engineer_id()::text);
CREATE POLICY "eng delete own receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'engineer-receipts' AND (storage.foldername(name))[1] = public.current_engineer_id()::text);

CREATE POLICY "eng read own certs files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'engineer-certifications' AND (
    (storage.foldername(name))[1] = public.current_engineer_id()::text
    OR public.has_role(auth.uid(),'admin')
  ));
CREATE POLICY "eng write own certs files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'engineer-certifications' AND (storage.foldername(name))[1] = public.current_engineer_id()::text);
CREATE POLICY "eng delete own certs files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'engineer-certifications' AND (storage.foldername(name))[1] = public.current_engineer_id()::text);

CREATE POLICY "eng read own signatures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'job-signatures' AND (
    (storage.foldername(name))[1] = public.current_engineer_id()::text
    OR public.has_role(auth.uid(),'admin')
  ));
CREATE POLICY "eng write own signatures" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-signatures' AND (storage.foldername(name))[1] = public.current_engineer_id()::text);
