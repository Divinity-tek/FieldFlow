CREATE TABLE public.project_sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    client_id uuid
        REFERENCES public.clients(id),

    site_code text,
    site_name text NOT NULL,

    address text,
    city text,
    state text,
    country text,
    postal_code text,

    latitude numeric,
    longitude numeric,

    contact_name text,
    contact_phone text,
    contact_email text,

    device_count integer DEFAULT 0,

    status text NOT NULL DEFAULT 'planning',

    planned_date date,
    completed_date date,

    notes text,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);




CREATE INDEX idx_project_sites_project
ON project_sites(project_id);

CREATE INDEX idx_project_sites_client
ON project_sites(client_id);

CREATE INDEX idx_project_sites_status
ON project_sites(status);

-- Important

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;



DROP TRIGGER IF EXISTS trg_project_sites_updated_at
ON public.project_sites;

CREATE TRIGGER trg_project_sites_updated_at
BEFORE UPDATE
ON public.project_sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();




ALTER TABLE public.project_sites
ENABLE ROW LEVEL SECURITY;

ALTER TABLE project_sites
ADD COLUMN created_by UUID REFERENCES auth.users(id);


CREATE POLICY "Authenticated users can view project sites"
ON public.project_sites
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert project sites"
ON public.project_sites
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update project sites"
ON public.project_sites
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete project sites"
ON public.project_sites
FOR DELETE
TO authenticated
USING (true);