DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_client_id_fkey'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.clients(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sd_wan_sites_client_id_fkey'
      AND conrelid = 'public.sd_wan_sites'::regclass
  ) THEN
    ALTER TABLE public.sd_wan_sites
      ADD CONSTRAINT sd_wan_sites_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.clients(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sd_wan_sites_project_id_fkey'
      AND conrelid = 'public.sd_wan_sites'::regclass
  ) THEN
    ALTER TABLE public.sd_wan_sites
      ADD CONSTRAINT sd_wan_sites_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES public.projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;