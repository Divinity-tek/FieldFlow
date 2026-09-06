
-- vendors: staff-only read
DROP POLICY IF EXISTS "Authenticated read vendors" ON public.vendors;
CREATE POLICY "Staff can view vendors" ON public.vendors
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));

-- shipments: staff or job stakeholders
DROP POLICY IF EXISTS "Authenticated can view shipments" ON public.shipments;
CREATE POLICY "Staff or job stakeholders view shipments" ON public.shipments
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'team_lead')
  OR public.has_role(auth.uid(),'associate_coordinator')
  OR created_by = auth.uid()
  OR (job_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = shipments.job_id
      AND (
        j.created_by = auth.uid()
        OR j.engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
        OR public.is_client_member(j.client_id, auth.uid())
      )
  ))
);

-- pricing_rules: staff-only read
DO $$ BEGIN
  EXECUTE (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON public.pricing_rules;', polname), ' ')
           FROM pg_policy WHERE polrelid = 'public.pricing_rules'::regclass AND polcmd = 'r');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Staff can view pricing rules" ON public.pricing_rules
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));

-- pricing_presets: staff/coordinator read
DO $$ BEGIN
  EXECUTE (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON public.pricing_presets;', polname), ' ')
           FROM pg_policy WHERE polrelid = 'public.pricing_presets'::regclass AND polcmd = 'r');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Staff can view pricing presets" ON public.pricing_presets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'team_lead')
  OR public.has_role(auth.uid(),'associate_coordinator')
);

-- job-attachments storage: restrict INSERT to job stakeholders
DROP POLICY IF EXISTS "Job attachments insert" ON storage.objects;
CREATE POLICY "Job attachments insert by stakeholders" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-attachments'
  AND (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'team_lead')
    OR public.has_role(auth.uid(),'associate_coordinator')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND (
          j.created_by = auth.uid()
          OR j.engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
          OR public.is_client_member(j.client_id, auth.uid())
        )
    )
  )
);
