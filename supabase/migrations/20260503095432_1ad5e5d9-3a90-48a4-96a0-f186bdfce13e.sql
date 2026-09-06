CREATE TABLE IF NOT EXISTS public.estimate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_shared boolean NOT NULL DEFAULT false,

  -- Estimate header defaults
  default_title text,
  currency text NOT NULL DEFAULT 'USD',
  valid_for_days integer,

  -- Tax / discount
  tax_mode text NOT NULL DEFAULT 'compound',
  tax1_label text NOT NULL DEFAULT 'Tax',
  tax1_rate numeric NOT NULL DEFAULT 0,
  tax2_label text NOT NULL DEFAULT 'Tax 2',
  tax2_rate numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,

  -- Dispatch defaults
  dispatch_nbd_tm numeric,
  dispatch_hourly numeric,
  dispatch_half_day numeric,
  dispatch_full_day numeric,
  dispatch_remarks text,

  -- Notes / branding overrides
  notes text,
  branding_enabled boolean NOT NULL DEFAULT false,
  branding_logo_url text,
  branding_primary_color text,
  branding_accent_color text,
  branding_footer_text text,
  branding_company_name text,

  -- Pre-filled line items
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_templates_owner ON public.estimate_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_shared ON public.estimate_templates(is_shared) WHERE is_shared;

ALTER TABLE public.estimate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their templates"
  ON public.estimate_templates FOR SELECT
  USING (auth.uid() = owner_id OR is_shared = true
         OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Owners insert their templates"
  ON public.estimate_templates FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update their templates"
  ON public.estimate_templates FOR UPDATE
  USING (auth.uid() = owner_id
         OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Owners delete their templates"
  ON public.estimate_templates FOR DELETE
  USING (auth.uid() = owner_id
         OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_estimate_templates_updated_at
  BEFORE UPDATE ON public.estimate_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();