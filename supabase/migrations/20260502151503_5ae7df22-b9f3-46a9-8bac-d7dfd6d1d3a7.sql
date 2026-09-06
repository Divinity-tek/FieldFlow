-- Allow admin-managed partners without a linked auth user yet
ALTER TABLE public.partners ALTER COLUMN user_id DROP NOT NULL;

-- Add structured address fields
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS country text;

-- Insert TEK CLOUDSOUL LTD as a managed partner
INSERT INTO public.partners (
  company_name, contact_name, email, address_line1, city, region, postcode, country
) VALUES (
  'TEK CLOUDSOUL LTD',
  'TEK Admin',
  'contact@tekcloudsoul.co.uk',
  '8 Cedar Road',
  'Newport',
  'Wales',
  'NP19 0BA',
  'United Kingdom'
);