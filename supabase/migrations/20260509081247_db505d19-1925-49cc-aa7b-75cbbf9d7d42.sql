CREATE POLICY "Partners view own projects"
ON public.projects
FOR SELECT
USING (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Partners create projects"
ON public.projects
FOR INSERT
WITH CHECK (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Partners update own projects"
ON public.projects
FOR UPDATE
USING (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid()
  )
);