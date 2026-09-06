
ALTER TABLE public.dispatch_leads
  ADD COLUMN IF NOT EXISTS estimated_turnaround_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS quoted_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

CREATE OR REPLACE FUNCTION public.dispatch_leads_status_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'quoted' AND NEW.quoted_at IS NULL THEN
      NEW.quoted_at := now();
    END IF;
    IF NEW.status = 'won' AND NEW.won_at IS NULL THEN
      NEW.won_at := now();
      NEW.closed_at := COALESCE(NEW.closed_at, now());
    END IF;
    IF NEW.status = 'lost' AND NEW.lost_at IS NULL THEN
      NEW.lost_at := now();
      NEW.closed_at := COALESCE(NEW.closed_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispatch_leads_status_timestamps ON public.dispatch_leads;
CREATE TRIGGER dispatch_leads_status_timestamps
  BEFORE UPDATE ON public.dispatch_leads
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_leads_status_timestamps();
