-- Remove engineers from Realtime publication to stop broadcasting identity doc URLs
ALTER PUBLICATION supabase_realtime DROP TABLE public.engineers;

-- Restrict job_engineer_splits SELECT to staff only (remove engineer self-read)
DROP POLICY IF EXISTS "Engineers view own splits" ON public.job_engineer_splits;

CREATE POLICY "Staff view engineer splits"
ON public.job_engineer_splits
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team_lead'::app_role)
  OR has_role(auth.uid(), 'associate_coordinator'::app_role)
  OR has_role(auth.uid(), 'partner'::app_role)
);