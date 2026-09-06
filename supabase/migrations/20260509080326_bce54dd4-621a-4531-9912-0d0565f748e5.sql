ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_partner_id ON public.projects(partner_id);