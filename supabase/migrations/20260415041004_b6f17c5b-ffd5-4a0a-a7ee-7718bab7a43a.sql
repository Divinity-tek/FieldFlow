
-- Add geofence_radius column to jobs
ALTER TABLE public.jobs ADD COLUMN geofence_radius integer NOT NULL DEFAULT 200;

-- Update the check_geofence function to use per-job radius
CREATE OR REPLACE FUNCTION public.check_geofence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
  v_dist DOUBLE PRECISION;
  v_radius DOUBLE PRECISION;
  v_last_event TEXT;
  v_eng_name TEXT;
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.latitude IS NOT DISTINCT FROM NEW.latitude
     AND OLD.longitude IS NOT DISTINCT FROM NEW.longitude THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name INTO v_eng_name
  FROM public.profiles p WHERE p.user_id = NEW.user_id;

  FOR v_job IN
    SELECT j.id, j.title, j.latitude, j.longitude, j.client_id, j.geofence_radius
    FROM public.jobs j
    WHERE j.engineer_id = NEW.id
      AND j.status IN ('assigned', 'accepted', 'on_the_way', 'in_progress')
      AND j.latitude IS NOT NULL AND j.longitude IS NOT NULL
  LOOP
    v_radius := COALESCE(v_job.geofence_radius, 200);
    v_dist := public.haversine_meters(NEW.latitude, NEW.longitude, v_job.latitude, v_job.longitude);

    SELECT ge.event_type INTO v_last_event
    FROM public.geofence_events ge
    WHERE ge.engineer_id = NEW.id AND ge.job_id = v_job.id
    ORDER BY ge.created_at DESC LIMIT 1;

    IF v_dist <= v_radius AND (v_last_event IS NULL OR v_last_event != 'arrival') THEN
      INSERT INTO public.geofence_events (engineer_id, job_id, event_type, distance_meters, latitude, longitude)
      VALUES (NEW.id, v_job.id, 'arrival', v_dist, NEW.latitude, NEW.longitude);

      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        NEW.user_id,
        'Arrived at job site',
        format('You have arrived at %s (within %sm)', v_job.title, round(v_dist::numeric)),
        'geofence',
        jsonb_build_object('job_id', v_job.id, 'event_type', 'arrival', 'distance', round(v_dist::numeric))
      );

    ELSIF v_dist > v_radius AND v_last_event = 'arrival' THEN
      INSERT INTO public.geofence_events (engineer_id, job_id, event_type, distance_meters, latitude, longitude)
      VALUES (NEW.id, v_job.id, 'departure', v_dist, NEW.latitude, NEW.longitude);

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
$function$;
