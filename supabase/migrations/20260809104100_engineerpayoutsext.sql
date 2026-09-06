ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS documents_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS documents_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS documents_reviewed_by uuid;

UPDATE public.engineers
SET documents_reviewed = false
WHERE documents_reviewed IS NULL;





-- Add 'rejected' as a distinct outcome from 'failed' (failed = payment attempt
-- failed after approval; rejected = admin declined the request itself)
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'rejected';
-- ⚠️ replace `payout_status` with your actual enum type name for the
-- engineer_payouts.status column if it differs — run the pg_enum lookup
-- from earlier if unsure.

ALTER TABLE engineer_payouts ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);
ALTER TABLE engineer_payouts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE engineer_payouts ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE engineer_payouts ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(user_id);
ALTER TABLE engineer_payouts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;





CREATE POLICY engineer_insert_own_payout ON engineer_payouts FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM engineers WHERE engineers.id = engineer_payouts.engineer_id AND engineers.user_id = auth.uid())
  );

CREATE POLICY engineer_view_own_payouts ON engineer_payouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM engineers WHERE engineers.id = engineer_payouts.engineer_id AND engineers.user_id = auth.uid()));


ALTER TABLE engineer_payouts ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);
ALTER TABLE engineer_payouts ADD COLUMN IF NOT EXISTS description TEXT;