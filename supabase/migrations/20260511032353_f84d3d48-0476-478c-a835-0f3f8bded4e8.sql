-- Proof point stats editable by admins, readable by everyone (public landing page)
CREATE TABLE public.proof_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  icon TEXT NOT NULL DEFAULT 'TrendingUp',
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sub TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proof_points ENABLE ROW LEVEL SECURITY;

-- Public read (active rows only) — landing page is public
CREATE POLICY "Anyone can view active proof points"
ON public.proof_points
FOR SELECT
USING (is_active = true);

-- Admins can read all (including inactive) and manage everything
CREATE POLICY "Admins can view all proof points"
ON public.proof_points
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert proof points"
ON public.proof_points
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update proof points"
ON public.proof_points
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete proof points"
ON public.proof_points
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_proof_points_updated_at
BEFORE UPDATE ON public.proof_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_proof_points_sort ON public.proof_points (sort_order);

-- Seed with current landing-page values
INSERT INTO public.proof_points (icon, value, label, sub, sort_order) VALUES
  ('Clock',      '−68%',     'Avg dispatch time',         'Smart-hands ticket to engineer en-route', 10),
  ('CheckCircle','98.4%',    'First-time fix rate',       'L1/L2 jobs closed on first site visit',   20),
  ('Shield',     '99.2%',    'SLA compliance',            '4-hour, NBD and same-day SLAs hit',       30),
  ('MapPin',     '190+',     'Countries covered',         'Vetted L1, L2 and L3 engineers on the ground', 40),
  ('Zap',        '< 2 hrs',  'Mean time to on-site',      'Major metros for critical incidents',     50),
  ('TrendingUp', '4.92 / 5', 'Client satisfaction',       'Post-job CSAT for hands & feet visits',   60),
  ('FileText',   '100%',     'Photo-evidenced handover',  'Signed reports with site photos every job', 70),
  ('Users',      '12,000+',  'Certified field engineers', 'CCNA / CCNP / JNCIA / Fortinet NSE pool', 80);