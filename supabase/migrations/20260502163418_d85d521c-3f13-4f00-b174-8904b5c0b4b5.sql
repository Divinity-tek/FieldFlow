ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimate_number text UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.estimates_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_estimate_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estimate_number IS NULL OR NEW.estimate_number = '' THEN
    NEW.estimate_number := 'EST-' || LPAD(nextval('public.estimates_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_estimate_number ON public.estimates;
CREATE TRIGGER trg_set_estimate_number
BEFORE INSERT ON public.estimates
FOR EACH ROW EXECUTE FUNCTION public.set_estimate_number();

CREATE INDEX IF NOT EXISTS idx_estimates_partner_id ON public.estimates(partner_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);