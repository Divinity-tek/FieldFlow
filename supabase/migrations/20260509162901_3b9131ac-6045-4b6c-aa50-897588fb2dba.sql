CREATE OR REPLACE FUNCTION public.validate_job_payout_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_engineer UUID;
  receipt_count INT;
BEGIN
  -- Amount bounds
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Claim amount must be greater than 0' USING ERRCODE = '22023';
  END IF;
  IF NEW.amount > 100000 THEN
    RAISE EXCEPTION 'Claim amount exceeds maximum allowed (100000)' USING ERRCODE = '22023';
  END IF;

  -- Note length
  IF NEW.note IS NULL OR length(btrim(NEW.note)) < 5 THEN
    RAISE EXCEPTION 'Claim note must be at least 5 characters' USING ERRCODE = '22023';
  END IF;
  IF length(NEW.note) > 500 THEN
    RAISE EXCEPTION 'Claim note must be 500 characters or fewer' USING ERRCODE = '22023';
  END IF;

  -- Receipt(s) required: receipt_url is a '|' separated list of storage paths
  IF NEW.receipt_url IS NULL OR length(btrim(NEW.receipt_url)) = 0 THEN
    RAISE EXCEPTION 'At least one receipt file must be attached' USING ERRCODE = '22023';
  END IF;
  receipt_count := array_length(
    array_remove(string_to_array(NEW.receipt_url, '|'), ''),
    1
  );
  IF receipt_count IS NULL OR receipt_count < 1 THEN
    RAISE EXCEPTION 'At least one receipt file must be attached' USING ERRCODE = '22023';
  END IF;
  IF receipt_count > 5 THEN
    RAISE EXCEPTION 'A claim may have at most 5 receipt files' USING ERRCODE = '22023';
  END IF;

  -- Job must exist and belong to the same engineer (only enforced on insert
  -- or when job/engineer fields change, so admins can still review)
  IF TG_OP = 'INSERT' OR NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.engineer_id IS DISTINCT FROM OLD.engineer_id THEN
    SELECT engineer_id INTO job_engineer FROM public.jobs WHERE id = NEW.job_id;
    IF job_engineer IS NULL THEN
      RAISE EXCEPTION 'Job not found' USING ERRCODE = '23503';
    END IF;
    IF job_engineer IS DISTINCT FROM NEW.engineer_id THEN
      RAISE EXCEPTION 'Job is not assigned to this engineer' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_job_payout_claim_trg ON public.job_payout_claims;
CREATE TRIGGER validate_job_payout_claim_trg
BEFORE INSERT OR UPDATE ON public.job_payout_claims
FOR EACH ROW
EXECUTE FUNCTION public.validate_job_payout_claim();