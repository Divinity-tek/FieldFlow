
-- Create ticket category enum
CREATE TYPE public.ticket_category AS ENUM ('complaint', 'support', 'billing', 'general');

-- Create ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  description TEXT,
  category ticket_category NOT NULL DEFAULT 'general',
  status ticket_status NOT NULL DEFAULT 'open',
  priority job_priority NOT NULL DEFAULT 'medium',
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES public.jobs(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all tickets"
ON public.tickets FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads can manage all tickets"
ON public.tickets FOR ALL
USING (has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Clients can view own tickets"
ON public.tickets FOR SELECT
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can create own tickets"
ON public.tickets FOR INSERT
WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Partners can view client tickets"
ON public.tickets FOR SELECT
USING (client_id IN (
  SELECT c.id FROM clients c
  WHERE c.partner_id IN (SELECT p.id FROM partners p WHERE p.user_id = auth.uid())
));

-- Timestamp trigger
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
