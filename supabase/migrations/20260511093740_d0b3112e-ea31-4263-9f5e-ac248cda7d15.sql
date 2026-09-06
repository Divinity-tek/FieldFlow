
-- Add a server-only secret used to authenticate the pg_net -> dispatch-agent lifecycle call.
ALTER TABLE public.dispatch_agent_settings
  ADD COLUMN IF NOT EXISTS lifecycle_secret text;

UPDATE public.dispatch_agent_settings
   SET lifecycle_secret = encode(extensions.gen_random_bytes(32), 'hex')
 WHERE lifecycle_secret IS NULL;

-- Recreate the notify trigger function to forward the secret as a header.
CREATE OR REPLACE FUNCTION public.notify_dispatch_agent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event text;
  v_url text := 'https://hmefayqwjynhgkiulgmz.supabase.co/functions/v1/dispatch-agent';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZWZheXF3anluaGdraXVsZ216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjc0NDEsImV4cCI6MjA5MTc0MzQ0MX0.SjGECoC-80ia026Sekd0muAny5A5YLUSztc8ygmAEWQ';
  v_enabled boolean;
  v_secret text;
BEGIN
  SELECT enabled, lifecycle_secret INTO v_enabled, v_secret
    FROM public.dispatch_agent_settings LIMIT 1;
  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := 'status_changed';
    ELSIF NEW.is_delayed IS DISTINCT FROM OLD.is_delayed AND NEW.is_delayed = true THEN
      v_event := 'sla_risk';
    ELSIF NEW.engineer_id IS DISTINCT FROM OLD.engineer_id THEN
      v_event := 'reassigned';
    ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
      v_event := 'rescheduled';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key,
      'x-lifecycle-secret', COALESCE(v_secret, '')
    ),
    body := jsonb_build_object(
      'action', 'lifecycle',
      'event', v_event,
      'jobId', NEW.id,
      'old', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      'new', to_jsonb(NEW)
    )
  );

  RETURN NEW;
END;
$function$;
