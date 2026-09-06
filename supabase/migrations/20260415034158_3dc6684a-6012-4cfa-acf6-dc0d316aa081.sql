
-- Store engineer location snapshots for trail/history
CREATE TABLE public.engineer_location_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups by engineer + time
CREATE INDEX idx_location_history_engineer_time ON public.engineer_location_history (engineer_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.engineer_location_history ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage location history"
ON public.engineer_location_history
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Team leads can view all
CREATE POLICY "Team leads can view location history"
ON public.engineer_location_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'team_lead'));

-- Engineers can insert their own location
CREATE POLICY "Engineers can insert own location"
ON public.engineer_location_history
FOR INSERT
TO authenticated
WITH CHECK (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

-- Engineers can view own history
CREATE POLICY "Engineers can view own location history"
ON public.engineer_location_history
FOR SELECT
TO authenticated
USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

-- Trigger: auto-record location when engineer's lat/lng updates
CREATE OR REPLACE FUNCTION public.record_engineer_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL) AND
     (OLD.latitude IS DISTINCT FROM NEW.latitude OR OLD.longitude IS DISTINCT FROM NEW.longitude) THEN
    INSERT INTO public.engineer_location_history (engineer_id, latitude, longitude)
    VALUES (NEW.id, NEW.latitude, NEW.longitude);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_engineer_location
AFTER UPDATE ON public.engineers
FOR EACH ROW
EXECUTE FUNCTION public.record_engineer_location();

-- Enable realtime for location history
ALTER PUBLICATION supabase_realtime ADD TABLE public.engineer_location_history;
