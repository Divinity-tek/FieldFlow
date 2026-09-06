CREATE TABLE public.saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  date_mode TEXT NOT NULL DEFAULT 'custom',
  date_from DATE,
  date_to DATE,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_columns TEXT[] NOT NULL DEFAULT '{}',
  sort_column TEXT,
  sort_direction TEXT NOT NULL DEFAULT 'asc',
  chart_type TEXT NOT NULL DEFAULT 'none',
  chart_x TEXT,
  chart_y TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all saved reports"
ON public.saved_reports FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners read their saved reports"
ON public.saved_reports FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners insert their saved reports"
ON public.saved_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update their saved reports"
ON public.saved_reports FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete their saved reports"
ON public.saved_reports FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

CREATE TRIGGER saved_reports_updated_at
BEFORE UPDATE ON public.saved_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_saved_reports_owner ON public.saved_reports(owner_id);

CREATE TABLE public.report_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_report_id UUID NOT NULL REFERENCES public.saved_reports(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all schedules"
ON public.report_schedules FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners read their schedules"
ON public.report_schedules FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners insert their schedules"
ON public.report_schedules FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update their schedules"
ON public.report_schedules FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete their schedules"
ON public.report_schedules FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

CREATE TRIGGER report_schedules_updated_at
BEFORE UPDATE ON public.report_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_report_schedules_next_run ON public.report_schedules(next_run_at) WHERE is_active = true;