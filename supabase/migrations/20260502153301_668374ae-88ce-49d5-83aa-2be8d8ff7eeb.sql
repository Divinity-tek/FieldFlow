ALTER TABLE public.engineer_rate_cards
  ADD COLUMN IF NOT EXISTS after_hours_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekend_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS holiday_rate numeric NOT NULL DEFAULT 0;