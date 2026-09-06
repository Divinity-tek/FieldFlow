
-- 1) audit_logs: restrict insert to authenticated users
DROP POLICY IF EXISTS "Users insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 2) job_notes: filter internal notes for non-staff, allow client members to see non-internal notes
DROP POLICY IF EXISTS "Staff and stakeholders can view job notes" ON public.job_notes;
CREATE POLICY "Staff and stakeholders can view job notes"
ON public.job_notes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_lead')
  OR (
    -- non-staff: only non-internal notes, and only for jobs they're a stakeholder on
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_notes.job_id
        AND (
          j.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.engineers e WHERE e.id = j.engineer_id AND e.user_id = auth.uid())
          OR (j.client_id IS NOT NULL AND public.is_client_member(j.client_id, auth.uid()))
        )
    )
  )
);

-- 3) portal-attachments storage: restrict to members of the specific client folder
DROP POLICY IF EXISTS "Client members can read portal attachments" ON storage.objects;
DROP POLICY IF EXISTS "Portal attachments client read" ON storage.objects;
CREATE POLICY "Portal attachments owner client read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'portal-attachments'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.is_client_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

DROP POLICY IF EXISTS "Client members can upload portal attachments" ON storage.objects;
DROP POLICY IF EXISTS "Portal attachments client insert" ON storage.objects;
CREATE POLICY "Portal attachments owner client insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-attachments'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.is_client_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

-- 4) estimate_approval_rules + steps: restrict reads to admin/team_lead
DROP POLICY IF EXISTS "Authenticated users can view active rules" ON public.estimate_approval_rules;
CREATE POLICY "Staff can view approval rules"
ON public.estimate_approval_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

DROP POLICY IF EXISTS "Authenticated can view rule steps" ON public.estimate_approval_rule_steps;
CREATE POLICY "Staff can view approval rule steps"
ON public.estimate_approval_rule_steps
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));
