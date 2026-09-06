CREATE TABLE public.help_path_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.help_path_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed can read help aliases"
ON public.help_path_aliases FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert help aliases"
ON public.help_path_aliases FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update help aliases"
ON public.help_path_aliases FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete help aliases"
ON public.help_path_aliases FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER help_path_aliases_set_updated_at
BEFORE UPDATE ON public.help_path_aliases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_help_path_aliases_path ON public.help_path_aliases(path);