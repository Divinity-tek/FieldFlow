
-- Table to log geofence arrival/departure events
CREATE TABLE public.geofence_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('arrival', 'departure')),
  distance_meters DOUBLE PRECISION NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_geofence_events_engineer ON public.geofence_events (engineer_id, created_at DESC);
CREATE INDEX idx_geofence_events_job ON public.geofence_events (job_id, created_at DESC);

ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage geofence events"
ON public.geofence_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can view geofence events"
ON public.geofence_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Engineers can view own geofence events"
ON public.geofence_events FOR SELECT TO authenticated
USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

-- Function to calculate haversine distance in meters
CREATE OR REPLACE FUNCTION public.haversine_meters(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371000.0 * 2 * asin(sqrt(
    pow(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians(lon2 - lon1) / 2), 2)
  ))
$$;

-- Geofence check trigger function
CREATE OR REPLACE FUNCTION public.check_geofence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_dist DOUBLE PRECISION;
  v_radius DOUBLE PRECISION := 200; -- 200 meter geofence radius
  v_last_event TEXT;
  v_eng_name TEXT;
BEGIN
  -- Only check if engineer has coordinates
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only check if coordinates actually changed
  IF OLD.latitude IS NOT DISTINCT FROM NEW.latitude
     AND OLD.longitude IS NOT DISTINCT FROM NEW.longitude THEN
    RETURN NEW;
  END IF;

  -- Get engineer name for notifications
  SELECT p.full_name INTO v_eng_name
  FROM public.profiles p WHERE p.user_id = NEW.user_id;

  -- Check each active job assigned to this engineer
  FOR v_job IN
    SELECT j.id, j.title, j.latitude, j.longitude, j.client_id
    FROM public.jobs j
    WHERE j.engineer_id = NEW.id
      AND j.status IN ('assigned', 'accepted', 'on_the_way', 'in_progress')
      AND j.latitude IS NOT NULL AND j.longitude IS NOT NULL
  LOOP
    v_dist := public.haversine_meters(NEW.latitude, NEW.longitude, v_job.latitude, v_job.longitude);

    -- Get last geofence event for this engineer+job
    SELECT ge.event_type INTO v_last_event
    FROM public.geofence_events ge
    WHERE ge.engineer_id = NEW.id AND ge.job_id = v_job.id
    ORDER BY ge.created_at DESC LIMIT 1;

    -- Check for ARRIVAL (within radius, last event was not arrival)
    IF v_dist <= v_radius AND (v_last_event IS NULL OR v_last_event != 'arrival') THEN
      INSERT INTO public.geofence_events (engineer_id, job_id, event_type, distance_meters, latitude, longitude)
      VALUES (NEW.id, v_job.id, 'arrival', v_dist, NEW.latitude, NEW.longitude);

      -- Notify the engineer
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        NEW.user_id,
        'Arrived at job site',
        format('You have arrived at %s (within %sm)', v_job.title, round(v_dist::numeric)),
        'geofence',
        jsonb_build_object('job_id', v_job.id, 'event_type', 'arrival', 'distance', round(v_dist::numeric))
      );

    -- Check for DEPARTURE (outside radius, last event was arrival)
    ELSIF v_dist > v_radius AND v_last_event = 'arrival' THEN
      INSERT INTO public.geofence_events (engineer_id, job_id, event_type, distance_meters, latitude, longitude)
      VALUES (NEW.id, v_job.id, 'departure', v_dist, NEW.latitude, NEW.longitude);

      -- Notify the engineer
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        NEW.user_id,
        'Left job site',
        format('You have left %s (%sm away)', v_job.title, round(v_dist::numeric)),
        'geofence',
        jsonb_build_object('job_id', v_job.id, 'event_type', 'departure', 'distance', round(v_dist::numeric))
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach geofence trigger to engineers table (after location recording trigger)
CREATE TRIGGER trg_check_geofence
AFTER UPDATE ON public.engineers
FOR EACH ROW
EXECUTE FUNCTION public.check_geofence();

-- Enable realtime for geofence events
ALTER PUBLICATION supabase_realtime ADD TABLE public.geofence_events;
