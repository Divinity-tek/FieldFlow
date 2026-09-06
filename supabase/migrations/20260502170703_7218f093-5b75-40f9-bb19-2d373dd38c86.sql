ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS branding_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS branding_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS branding_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS branding_footer_text TEXT,
  ADD COLUMN IF NOT EXISTS branding_company_name TEXT;