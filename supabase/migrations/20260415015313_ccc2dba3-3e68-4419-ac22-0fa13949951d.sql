
CREATE POLICY "Engineers can update assigned tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (assigned_to IN (
  SELECT e.user_id FROM engineers e WHERE e.user_id = auth.uid()
))
WITH CHECK (assigned_to IN (
  SELECT e.user_id FROM engineers e WHERE e.user_id = auth.uid()
));
