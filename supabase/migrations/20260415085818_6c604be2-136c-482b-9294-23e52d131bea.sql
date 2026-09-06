
ALTER TABLE public.engineers
  ADD COLUMN insurance_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN insurance_verified_at timestamptz,
  ADD COLUMN insurance_verified_by uuid,
  ADD COLUMN vehicle_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN vehicle_verified_at timestamptz,
  ADD COLUMN vehicle_verified_by uuid;
