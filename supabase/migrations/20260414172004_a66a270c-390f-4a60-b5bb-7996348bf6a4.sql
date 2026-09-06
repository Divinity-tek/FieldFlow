
CREATE TABLE public.engineer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id uuid NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engineer_id, date)
);

ALTER TABLE public.engineer_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view availability"
  ON public.engineer_availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage availability"
  ON public.engineer_availability FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can manage availability"
  ON public.engineer_availability FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Engineers can manage own availability"
  ON public.engineer_availability FOR ALL
  TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

CREATE INDEX idx_engineer_availability_date ON public.engineer_availability (engineer_id, date);

CREATE TRIGGER update_engineer_availability_updated_at
  BEFORE UPDATE ON public.engineer_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
