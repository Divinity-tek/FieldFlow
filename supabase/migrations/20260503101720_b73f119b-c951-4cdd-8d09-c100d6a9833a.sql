ALTER TABLE public.estimate_templates
  ADD COLUMN IF NOT EXISTS dispatch_sbd_tm numeric;