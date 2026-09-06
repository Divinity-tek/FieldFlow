ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.engineer_rate_cards
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rate_cards_partner ON public.engineer_rate_cards(partner_id);