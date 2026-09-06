-- Computed columns on jobs (maintained by trigger)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS gross_payout numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_cut numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_cut numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engineer_net numeric NOT NULL DEFAULT 0;

ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS gross_payout numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_cut numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_cut numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engineer_net numeric NOT NULL DEFAULT 0;

-- Trigger fn for jobs (base = coalesce(engineer_charge, total_price, base_price, 0))
CREATE OR REPLACE FUNCTION public.recalc_job_payout()
RETURNS TRIGGER AS $$
DECLARE
  base numeric;
  gross numeric;
  partner_pct numeric;
  platform_pct numeric;
BEGIN
  base := COALESCE(NEW.engineer_charge, NEW.total_price, NEW.base_price, 0);
  gross := base
         + COALESCE(NEW.transport_allowance, 0)
         + COALESCE(NEW.food_allowance, 0)
         + COALESCE(NEW.convenience_allowance, 0);

  partner_pct := LEAST(GREATEST(COALESCE(NEW.partner_split_percent, 0), 0), 100);
  platform_pct := LEAST(GREATEST(COALESCE(NEW.platform_split_percent, 0), 0), 100);
  -- Cap combined splits at 100%
  IF (partner_pct + platform_pct) > 100 THEN
    platform_pct := 100 - partner_pct;
  END IF;

  NEW.gross_payout := ROUND(gross::numeric, 2);
  NEW.partner_cut := ROUND((gross * partner_pct / 100)::numeric, 2);
  NEW.platform_cut := ROUND((gross * platform_pct / 100)::numeric, 2);
  NEW.engineer_net := ROUND((gross - NEW.partner_cut - NEW.platform_cut)::numeric, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS jobs_recalc_payout ON public.jobs;
CREATE TRIGGER jobs_recalc_payout
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.recalc_job_payout();

-- Trigger fn for marketplace listings (base = posted_pay)
CREATE OR REPLACE FUNCTION public.recalc_listing_payout()
RETURNS TRIGGER AS $$
DECLARE
  base numeric;
  gross numeric;
  partner_pct numeric;
  platform_pct numeric;
BEGIN
  base := COALESCE(NEW.posted_pay, 0);
  gross := base
         + COALESCE(NEW.transport_allowance, 0)
         + COALESCE(NEW.food_allowance, 0)
         + COALESCE(NEW.convenience_allowance, 0);

  partner_pct := LEAST(GREATEST(COALESCE(NEW.partner_split_percent, 0), 0), 100);
  platform_pct := LEAST(GREATEST(COALESCE(NEW.platform_split_percent, 0), 0), 100);
  IF (partner_pct + platform_pct) > 100 THEN
    platform_pct := 100 - partner_pct;
  END IF;

  NEW.gross_payout := ROUND(gross::numeric, 2);
  NEW.partner_cut := ROUND((gross * partner_pct / 100)::numeric, 2);
  NEW.platform_cut := ROUND((gross * platform_pct / 100)::numeric, 2);
  NEW.engineer_net := ROUND((gross - NEW.partner_cut - NEW.platform_cut)::numeric, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS listings_recalc_payout ON public.marketplace_listings;
CREATE TRIGGER listings_recalc_payout
BEFORE INSERT OR UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.recalc_listing_payout();

-- Backfill existing rows
UPDATE public.jobs SET id = id;
UPDATE public.marketplace_listings SET id = id;