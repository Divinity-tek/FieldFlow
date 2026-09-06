
-- Client Communication History
CREATE TABLE public.client_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'note',
  subject TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage communications" ON public.client_communications FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage communications" ON public.client_communications FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Clients can view own communications" ON public.client_communications FOR SELECT TO authenticated USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Lead Pipeline
CREATE TABLE public.lead_pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'new_lead',
  notes TEXT,
  deal_value NUMERIC DEFAULT 0,
  expected_close_date DATE,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leads" ON public.lead_pipeline FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage leads" ON public.lead_pipeline FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Partners can view client leads" ON public.lead_pipeline FOR SELECT TO authenticated USING (client_id IN (SELECT c.id FROM clients c WHERE c.partner_id IN (SELECT p.id FROM partners p WHERE p.user_id = auth.uid())));

CREATE TRIGGER update_lead_pipeline_updated_at BEFORE UPDATE ON public.lead_pipeline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Follow-up Reminders
CREATE TABLE public.follow_up_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminders" ON public.follow_up_reminders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage reminders" ON public.follow_up_reminders FOR ALL TO authenticated USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Users can manage own reminders" ON public.follow_up_reminders FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_follow_up_reminders_updated_at BEFORE UPDATE ON public.follow_up_reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
