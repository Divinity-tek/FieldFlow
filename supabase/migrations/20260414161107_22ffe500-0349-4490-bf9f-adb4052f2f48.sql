
-- Create SLA policies table
CREATE TABLE public.sla_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority public.job_priority NOT NULL DEFAULT 'medium',
  response_time_minutes INTEGER NOT NULL DEFAULT 60,
  resolution_time_minutes INTEGER NOT NULL DEFAULT 480,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage SLA policies" ON public.sla_policies FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage SLA policies" ON public.sla_policies FOR ALL USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Clients can view own SLA policies" ON public.sla_policies FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
CREATE POLICY "Partners can view client SLA policies" ON public.sla_policies FOR SELECT USING (client_id IN (SELECT c.id FROM clients c WHERE c.partner_id IN (SELECT p.id FROM partners p WHERE p.user_id = auth.uid())));

CREATE TRIGGER update_sla_policies_updated_at BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint so each client has one policy per priority
ALTER TABLE public.sla_policies ADD CONSTRAINT unique_client_priority UNIQUE (client_id, priority);
