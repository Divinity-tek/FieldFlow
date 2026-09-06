
-- Inventory Items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  location TEXT,
  warehouse TEXT,
  assigned_engineer_id UUID REFERENCES public.engineers(id),
  assigned_job_id UUID REFERENCES public.jobs(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inventory" ON public.inventory_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Team leads can manage inventory" ON public.inventory_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'));
CREATE POLICY "Authenticated can view inventory" ON public.inventory_items FOR SELECT TO authenticated USING (true);

-- Site Surveys table
CREATE TABLE public.site_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  engineer_id UUID REFERENCES public.engineers(id),
  survey_type TEXT NOT NULL DEFAULT 'pre_installation',
  status TEXT NOT NULL DEFAULT 'draft',
  checklist JSONB DEFAULT '[]'::jsonb,
  findings TEXT,
  recommendations TEXT,
  photos TEXT[] DEFAULT '{}'::text[],
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage surveys" ON public.site_surveys FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Team leads can manage surveys" ON public.site_surveys FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'));
CREATE POLICY "Engineers can manage own surveys" ON public.site_surveys FOR ALL TO authenticated USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()));
CREATE POLICY "Clients can view own surveys" ON public.site_surveys FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Shipments table
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_number TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparing',
  carrier TEXT,
  estimated_delivery DATE,
  actual_delivery DATE,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  job_id UUID REFERENCES public.jobs(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage shipments" ON public.shipments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Team leads can manage shipments" ON public.shipments FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'));
CREATE POLICY "Authenticated can view shipments" ON public.shipments FOR SELECT TO authenticated USING (true);

-- Knowledge Articles table
CREATE TABLE public.knowledge_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}'::text[],
  author_id UUID,
  is_published BOOLEAN NOT NULL DEFAULT false,
  views_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage articles" ON public.knowledge_articles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Team leads can manage articles" ON public.knowledge_articles FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'));
CREATE POLICY "Authenticated can view published articles" ON public.knowledge_articles FOR SELECT TO authenticated USING (is_published = true);

-- Update triggers
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_surveys_updated_at BEFORE UPDATE ON public.site_surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_knowledge_articles_updated_at BEFORE UPDATE ON public.knowledge_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
