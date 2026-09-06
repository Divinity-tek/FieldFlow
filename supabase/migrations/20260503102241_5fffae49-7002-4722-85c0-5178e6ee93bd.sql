ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS dispatch_sbd_tm numeric;
ALTER TABLE public.invoices  ADD COLUMN IF NOT EXISTS dispatch_sbd_tm numeric;