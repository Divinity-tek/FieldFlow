ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_vehicle boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_insurance boolean NOT NULL DEFAULT true;