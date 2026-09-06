ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (identity_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS identity_review_note TEXT,
  ADD COLUMN IF NOT EXISTS identity_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS identity_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_submitted_at TIMESTAMPTZ;

-- Auto-set submitted_at when files first appear / change, and reset to pending
CREATE OR REPLACE FUNCTION public.track_engineer_identity_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.identity_selfie_url IS DISTINCT FROM COALESCE(OLD.identity_selfie_url, ''))
     OR (NEW.id_card_url IS DISTINCT FROM COALESCE(OLD.id_card_url, '')) THEN
    NEW.identity_submitted_at := now();
    -- Only auto-reset if the change wasn't accompanied by a status change by an admin
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

DROP TRIGGER IF EXISTS track_engineer_identity_submission_trg ON public.engineers;
CREATE TRIGGER track_engineer_identity_submission_trg
BEFORE UPDATE OF identity_selfie_url, id_card_url ON public.engineers
FOR EACH ROW EXECUTE FUNCTION public.track_engineer_identity_submission();

CREATE INDEX IF NOT EXISTS idx_engineers_identity_status ON public.engineers(identity_status);