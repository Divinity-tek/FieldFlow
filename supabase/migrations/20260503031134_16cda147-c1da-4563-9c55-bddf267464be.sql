ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS dispatch_nbd_tm numeric,
  ADD COLUMN IF NOT EXISTS dispatch_hourly numeric,
  ADD COLUMN IF NOT EXISTS dispatch_half_day numeric,
  ADD COLUMN IF NOT EXISTS dispatch_full_day numeric,
  ADD COLUMN IF NOT EXISTS dispatch_remarks text;