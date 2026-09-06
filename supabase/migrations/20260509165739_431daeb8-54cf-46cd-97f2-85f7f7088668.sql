CREATE OR REPLACE FUNCTION public.track_engineer_identity_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.identity_selfie_url IS DISTINCT FROM COALESCE(OLD.identity_selfie_url, ''))
     OR (NEW.id_card_url IS DISTINCT FROM COALESCE(OLD.id_card_url, '')) THEN
    NEW.identity_submitted_at := now();
    IF NEW.identity_status = COALESCE(OLD.identity_status, 'pending') THEN
      NEW.identity_status := 'pending';
      NEW.identity_review_note := NULL;
      NEW.identity_reviewed_by := NULL;
      NEW.identity_reviewed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;