-- Branding settings for estimate PDFs (single-row config table)
CREATE TABLE public.estimate_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  company_address TEXT,
  company_email TEXT,
  company_phone TEXT,
  company_website TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#2563eb',
  accent_color TEXT NOT NULL DEFAULT '#1e293b',
  footer_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view branding"
  ON public.estimate_branding FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins and team leads can insert branding"
  ON public.estimate_branding FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Admins and team leads can update branding"
  ON public.estimate_branding FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Admins can delete branding"
  ON public.estimate_branding FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_estimate_branding_updated_at
  BEFORE UPDATE ON public.estimate_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public storage bucket for estimate logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('estimate-branding', 'estimate-branding', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Estimate branding logos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'estimate-branding');

CREATE POLICY "Admins/team leads can upload estimate branding logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'estimate-branding'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
  );

CREATE POLICY "Admins/team leads can update estimate branding logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'estimate-branding'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
  );

CREATE POLICY "Admins/team leads can delete estimate branding logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'estimate-branding'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
  );