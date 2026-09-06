CREATE POLICY "Dispatch staff can view job events"
ON public.job_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'team_lead'::app_role)
  OR has_role(auth.uid(), 'associate_coordinator'::app_role)
);