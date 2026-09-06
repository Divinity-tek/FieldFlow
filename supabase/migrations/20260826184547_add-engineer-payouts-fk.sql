-- 1. Ensure the column exists on engineer_payouts
ALTER TABLE engineer_payouts 
  ADD COLUMN IF NOT EXISTS job_id UUID;

-- 2. Drop constraint if it already exists (prevents duplicate constraint errors on re-run)
ALTER TABLE engineer_payouts 
  DROP CONSTRAINT IF EXISTS engineer_payouts_job_id_fkey;

-- 3. Add the Foreign Key constraint
ALTER TABLE engineer_payouts 
  ADD CONSTRAINT engineer_payouts_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;