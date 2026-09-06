ALTER TABLE public.estimate_templates
  ADD COLUMN IF NOT EXISTS dispatch_sbd_hourly numeric,
  ADD COLUMN IF NOT EXISTS dispatch_sbd_half_day numeric,
  ADD COLUMN IF NOT EXISTS dispatch_sbd_full_day numeric;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS dispatch_sbd_hourly numeric,
  ADD COLUMN IF NOT EXISTS dispatch_sbd_half_day numeric,
  ADD COLUMN IF NOT EXISTS dispatch_sbd_full_day numeric;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS dispatch_sbd_hourly numeric,
  ADD COLUMN IF NOT EXISTS dispatch_sbd_half_day numeric,
  ADD COLUMN IF NOT EXISTS dispatch_sbd_full_day numeric;