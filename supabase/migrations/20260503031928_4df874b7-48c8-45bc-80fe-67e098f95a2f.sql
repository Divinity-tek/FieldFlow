CREATE OR REPLACE FUNCTION public.validate_estimate_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_max numeric := 1000000;
BEGIN
  IF NEW.dispatch_nbd_tm IS NOT NULL THEN
    IF NEW.dispatch_nbd_tm < 0 THEN
      RAISE EXCEPTION 'field:dispatch_nbd_tm | NBD T&M rate must be greater than or equal to 0';
    ELSIF NEW.dispatch_nbd_tm > v_max THEN
      RAISE EXCEPTION 'field:dispatch_nbd_tm | NBD T&M rate exceeds maximum allowed (1,000,000)';
    END IF;
  END IF;

  IF NEW.dispatch_hourly IS NOT NULL THEN
    IF NEW.dispatch_hourly < 0 THEN
      RAISE EXCEPTION 'field:dispatch_hourly | Hourly rate must be greater than or equal to 0';
    ELSIF NEW.dispatch_hourly > v_max THEN
      RAISE EXCEPTION 'field:dispatch_hourly | Hourly rate exceeds maximum allowed (1,000,000)';
    END IF;
  END IF;

  IF NEW.dispatch_half_day IS NOT NULL THEN
    IF NEW.dispatch_half_day < 0 THEN
      RAISE EXCEPTION 'field:dispatch_half_day | Half-day rate must be greater than or equal to 0';
    ELSIF NEW.dispatch_half_day > v_max THEN
      RAISE EXCEPTION 'field:dispatch_half_day | Half-day rate exceeds maximum allowed (1,000,000)';
    END IF;
  END IF;

  IF NEW.dispatch_full_day IS NOT NULL THEN
    IF NEW.dispatch_full_day < 0 THEN
      RAISE EXCEPTION 'field:dispatch_full_day | Full-day rate must be greater than or equal to 0';
    ELSIF NEW.dispatch_full_day > v_max THEN
      RAISE EXCEPTION 'field:dispatch_full_day | Full-day rate exceeds maximum allowed (1,000,000)';
    END IF;
  END IF;

  IF NEW.dispatch_remarks IS NOT NULL AND char_length(NEW.dispatch_remarks) > 1000 THEN
    RAISE EXCEPTION 'field:dispatch_remarks | Remarks must be 1000 characters or fewer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_estimate_dispatch ON public.estimates;
CREATE TRIGGER trg_validate_estimate_dispatch
BEFORE INSERT OR UPDATE OF dispatch_nbd_tm, dispatch_hourly, dispatch_half_day, dispatch_full_day, dispatch_remarks
ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.validate_estimate_dispatch();