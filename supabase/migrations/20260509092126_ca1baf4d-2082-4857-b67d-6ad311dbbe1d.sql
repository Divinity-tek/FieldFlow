CREATE TABLE IF NOT EXISTS public.engineer_availability_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id uuid NOT NULL UNIQUE REFERENCES public.engineers(id) ON DELETE CASCADE,
  business_hours boolean NOT NULL DEFAULT true,
  business_start time NOT NULL DEFAULT '09:00',
  business_end time NOT NULL DEFAULT '17:00',
  business_days int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  after_hours boolean NOT NULL DEFAULT false,
  nights boolean NOT NULL DEFAULT false,
  weekends boolean NOT NULL DEFAULT false,
  holidays boolean NOT NULL DEFAULT false,
  timezone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.engineer_availability_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers manage own availability prefs"
ON public.engineer_availability_preferences
FOR ALL TO authenticated
USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()))
WITH CHECK (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all availability prefs"
ON public.engineer_availability_preferences
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads manage all availability prefs"
ON public.engineer_availability_preferences
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'team_lead'))
WITH CHECK (public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Coordinators view availability prefs"
ON public.engineer_availability_preferences
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'));

CREATE TRIGGER update_engineer_availability_prefs_updated_at
BEFORE UPDATE ON public.engineer_availability_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();