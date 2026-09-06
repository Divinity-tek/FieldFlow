
-- Create dispatch tickets table
CREATE TABLE public.dispatch_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE DEFAULT 'DT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  
  -- SOW Details
  title TEXT NOT NULL,
  dispatch_type TEXT NOT NULL DEFAULT 'general',
  sow_description TEXT NOT NULL DEFAULT '',
  scope_of_work_items JSONB DEFAULT '[]'::jsonb,
  
  -- Site Info
  site_address TEXT NOT NULL DEFAULT '',
  contact_person TEXT,
  contact_phone TEXT,
  
  -- Time & Rate
  estimated_hours NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  travel_time NUMERIC DEFAULT 0,
  travel_rate NUMERIC DEFAULT 0,
  materials_cost NUMERIC DEFAULT 0,
  estimated_charges NUMERIC GENERATED ALWAYS AS (
    (estimated_hours * hourly_rate) + (COALESCE(travel_time, 0) * COALESCE(travel_rate, 0)) + COALESCE(materials_cost, 0)
  ) STORED,
  
  -- Actuals
  actual_hours NUMERIC DEFAULT 0,
  actual_charges NUMERIC DEFAULT 0,
  
  -- Workflow
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  client_approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  engineer_notes TEXT,
  
  -- Schedule
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_tickets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all dispatch tickets"
  ON public.dispatch_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leads can manage all dispatch tickets"
  ON public.dispatch_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role));

CREATE POLICY "Engineers can view assigned dispatch tickets"
  ON public.dispatch_tickets FOR SELECT TO authenticated
  USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()));

CREATE POLICY "Engineers can update assigned dispatch tickets"
  ON public.dispatch_tickets FOR UPDATE TO authenticated
  USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view own dispatch tickets"
  ON public.dispatch_tickets FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can update approval on own tickets"
  ON public.dispatch_tickets FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_dispatch_tickets_updated_at
  BEFORE UPDATE ON public.dispatch_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_dispatch_tickets_client ON public.dispatch_tickets(client_id);
CREATE INDEX idx_dispatch_tickets_engineer ON public.dispatch_tickets(engineer_id);
CREATE INDEX idx_dispatch_tickets_status ON public.dispatch_tickets(status);
