ALTER TABLE public.estimate_templates
  ADD COLUMN IF NOT EXISTS custom_columns jsonb NOT NULL DEFAULT '[]'::jsonb;