CREATE POLICY "Service desk view projects"
ON public.projects
FOR SELECT
USING (public.has_role(auth.uid(), 'service_desk'));