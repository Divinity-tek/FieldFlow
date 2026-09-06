
CREATE TABLE public.engineer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.engineer_ratings ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_engineer_ratings_job ON public.engineer_ratings(job_id);
CREATE INDEX idx_engineer_ratings_engineer ON public.engineer_ratings(engineer_id);

CREATE POLICY "Clients can create ratings" ON public.engineer_ratings
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients can view own ratings" ON public.engineer_ratings
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Engineers can view own ratings" ON public.engineer_ratings
  FOR SELECT USING (
    engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage ratings" ON public.engineer_ratings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
