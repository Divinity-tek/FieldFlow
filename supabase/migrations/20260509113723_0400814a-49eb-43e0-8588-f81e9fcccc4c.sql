-- Payout status enum
DO $$ BEGIN
  CREATE TYPE public.payout_status AS ENUM ('pending', 'partially_paid', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add payout status + approval/payment timestamps to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payout_status public.payout_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_approved_by uuid,
  ADD COLUMN IF NOT EXISTS payout_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_paid_by uuid;

-- Same for marketplace_listings
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS payout_status public.payout_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_approved_by uuid,
  ADD COLUMN IF NOT EXISTS payout_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_paid_by uuid;

-- Trigger: auto-derive payout_status from paid amount vs engineer_net, and stamp paid_at
CREATE OR REPLACE FUNCTION public._sync_payout_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  net numeric := COALESCE(NEW.engineer_net, 0);
  paid numeric := COALESCE(NEW.payout_paid_amount, 0);
BEGIN
  IF paid <= 0 THEN
    NEW.payout_status := 'pending';
    NEW.payout_paid_at := NULL;
  ELSIF net > 0 AND paid >= net THEN
    NEW.payout_status := 'paid';
    IF NEW.payout_paid_at IS NULL THEN NEW.payout_paid_at := now(); END IF;
  ELSE
    NEW.payout_status := 'partially_paid';
    IF NEW.payout_paid_at IS NULL THEN NEW.payout_paid_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_payout_status_jobs ON public.jobs;
CREATE TRIGGER sync_payout_status_jobs
  BEFORE INSERT OR UPDATE OF payout_paid_amount, engineer_net ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public._sync_payout_status();

DROP TRIGGER IF EXISTS sync_payout_status_listings ON public.marketplace_listings;
CREATE TRIGGER sync_payout_status_listings
  BEFORE INSERT OR UPDATE OF payout_paid_amount, engineer_net ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public._sync_payout_status();