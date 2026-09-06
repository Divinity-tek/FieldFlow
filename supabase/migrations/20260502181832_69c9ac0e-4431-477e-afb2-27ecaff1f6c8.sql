CREATE OR REPLACE FUNCTION public.trg_jobs_smart_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.engineer_id IS NULL AND NEW.status::text IN ('pending', 'open') THEN
    PERFORM public.evaluate_smart_match_for_job(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;