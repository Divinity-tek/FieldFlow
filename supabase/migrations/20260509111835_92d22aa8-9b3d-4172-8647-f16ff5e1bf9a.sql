-- 1) Allowance columns on listings (admin sets at posting time)
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS transport_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS food_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convenience_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_split_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_split_percent numeric NOT NULL DEFAULT 0;

-- 2) Allowance + split columns on jobs (admin sets/edits, mirrored from listing on assignment)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS transport_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS food_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convenience_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_split_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_split_percent numeric NOT NULL DEFAULT 0;

-- 3) Multi-engineer split table (job split across multiple engineers)
CREATE TABLE IF NOT EXISTS public.job_engineer_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  engineer_id uuid NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  share_percent numeric NOT NULL DEFAULT 0,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, engineer_id)
);
CREATE INDEX IF NOT EXISTS idx_job_engineer_splits_job ON public.job_engineer_splits(job_id);
CREATE INDEX IF NOT EXISTS idx_job_engineer_splits_engineer ON public.job_engineer_splits(engineer_id);

ALTER TABLE public.job_engineer_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage engineer splits"
ON public.job_engineer_splits FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team_lead'::app_role) OR has_role(auth.uid(), 'associate_coordinator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team_lead'::app_role) OR has_role(auth.uid(), 'associate_coordinator'::app_role));

CREATE POLICY "Engineers view own splits"
ON public.job_engineer_splits FOR SELECT
USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

CREATE TRIGGER job_engineer_splits_set_updated_at
BEFORE UPDATE ON public.job_engineer_splits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Engineer claims (actuals submitted after the job)
CREATE TABLE IF NOT EXISTS public.job_payout_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  engineer_id uuid NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  claim_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_payout_claims_job ON public.job_payout_claims(job_id);
CREATE INDEX IF NOT EXISTS idx_job_payout_claims_engineer ON public.job_payout_claims(engineer_id);
CREATE INDEX IF NOT EXISTS idx_job_payout_claims_status ON public.job_payout_claims(status);

-- Validate claim_type and status via trigger (avoids check-constraint immutability issues)
CREATE OR REPLACE FUNCTION public.validate_job_payout_claim()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.claim_type NOT IN ('transport','food','convenience','other') THEN
    RAISE EXCEPTION 'Invalid claim_type: %', NEW.claim_type;
  END IF;
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.amount < 0 THEN
    RAISE EXCEPTION 'Amount must be >= 0';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER job_payout_claims_validate
BEFORE INSERT OR UPDATE ON public.job_payout_claims
FOR EACH ROW EXECUTE FUNCTION public.validate_job_payout_claim();

CREATE TRIGGER job_payout_claims_set_updated_at
BEFORE UPDATE ON public.job_payout_claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.job_payout_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers create own claims"
ON public.job_payout_claims FOR INSERT
WITH CHECK (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

CREATE POLICY "Engineers view own claims"
ON public.job_payout_claims FOR SELECT
USING (
  engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team_lead'::app_role)
  OR has_role(auth.uid(), 'associate_coordinator'::app_role)
);

CREATE POLICY "Engineers update own pending claims"
ON public.job_payout_claims FOR UPDATE
USING (
  engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  AND status = 'pending'
);

CREATE POLICY "Admins manage claims"
ON public.job_payout_claims FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team_lead'::app_role) OR has_role(auth.uid(), 'associate_coordinator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team_lead'::app_role) OR has_role(auth.uid(), 'associate_coordinator'::app_role));