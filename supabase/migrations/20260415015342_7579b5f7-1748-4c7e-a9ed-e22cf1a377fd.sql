
CREATE POLICY "Engineers can view assigned tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (assigned_to IN (
  SELECT e.user_id FROM engineers e WHERE e.user_id = auth.uid()
));
