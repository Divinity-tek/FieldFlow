CREATE TABLE IF NOT EXISTS public.pricing_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  sku text,
  unit_price numeric NOT NULL DEFAULT 0,
  default_quantity numeric NOT NULL DEFAULT 1,
  default_tax_rate numeric NOT NULL DEFAULT 0,
  default_discount_percent numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_presets_active ON public.pricing_presets(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_presets_category ON public.pricing_presets(category);

ALTER TABLE public.pricing_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage presets"
  ON public.pricing_presets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads manage presets"
  ON public.pricing_presets FOR ALL
  USING (public.has_role(auth.uid(), 'team_lead'))
  WITH CHECK (public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Authenticated can view active presets"
  ON public.pricing_presets FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER trg_pricing_presets_updated
  BEFORE UPDATE ON public.pricing_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();