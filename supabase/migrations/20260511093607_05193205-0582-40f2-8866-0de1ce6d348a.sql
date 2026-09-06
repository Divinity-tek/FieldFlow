
-- 1. Tighten dispatch_leads policies to authenticated role only
ALTER POLICY "Admins can delete dispatch leads" ON public.dispatch_leads TO authenticated;
ALTER POLICY "Staff can update dispatch leads" ON public.dispatch_leads TO authenticated;
ALTER POLICY "Staff can view dispatch leads" ON public.dispatch_leads TO authenticated;

-- 2. Tighten dispatch_agent_actions INSERT to staff only
DROP POLICY IF EXISTS "Auth can insert actions" ON public.dispatch_agent_actions;
CREATE POLICY "Staff can insert actions" ON public.dispatch_agent_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'team_lead'::public.app_role)
    OR public.has_role(auth.uid(), 'associate_coordinator'::public.app_role)
  );

-- 3. Storage: add admin UPDATE/DELETE for job-signatures bucket
CREATE POLICY "Admins manage job-signatures"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-signatures' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update job-signatures"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'job-signatures' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'job-signatures' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Storage: tighten certification-documents INSERT/UPDATE/DELETE to require engineer record
DROP POLICY IF EXISTS "Engineers upload own cert documents" ON storage.objects;
CREATE POLICY "Engineers upload own cert documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certification-documents'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (SELECT 1 FROM public.engineers e WHERE e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Engineers update own cert documents" ON storage.objects;
CREATE POLICY "Engineers update own cert documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'certification-documents'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (SELECT 1 FROM public.engineers e WHERE e.user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'certification-documents'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (SELECT 1 FROM public.engineers e WHERE e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Engineers delete own cert documents" ON storage.objects;
CREATE POLICY "Engineers delete own cert documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'certification-documents'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
