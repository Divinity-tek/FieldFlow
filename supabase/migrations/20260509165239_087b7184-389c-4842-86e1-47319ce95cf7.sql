ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS identity_selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS id_card_url TEXT;