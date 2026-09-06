
-- Tighten job_reassignments INSERT: drop permissive public policy, restrict to staff
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.job_reassignments'::regclass
      AND polcmd = 'a' -- INSERT
  LOOP
    EXECUTE format('DROP POLICY %I ON public.job_reassignments', r.polname);
  END LOOP;
END $$;

CREATE POLICY "Staff can insert reassignment audit"
  ON public.job_reassignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
    OR public.has_role(auth.uid(), 'associate_coordinator')
  );

-- Tighten audit_logs INSERT: restrict policy role from public to authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.audit_logs'::regclass
      AND polcmd = 'a' -- INSERT
  LOOP
    EXECUTE format('DROP POLICY %I ON public.audit_logs', r.polname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users insert their audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
