
-- Create estimate status enum
CREATE TYPE public.estimate_status AS ENUM ('draft', 'sent', 'approved', 'rejected', 'expired');

-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- Create estimates table
CREATE TABLE public.estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  job_id UUID REFERENCES public.jobs(id),
  status estimate_status NOT NULL DEFAULT 'draft',
  valid_until DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all estimates" ON public.estimates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage all estimates" ON public.estimates FOR ALL USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Clients can view own estimates" ON public.estimates FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
CREATE POLICY "Clients can update own estimate status" ON public.estimates FOR UPDATE USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
CREATE POLICY "Partners can view client estimates" ON public.estimates FOR SELECT USING (client_id IN (SELECT c.id FROM clients c WHERE c.partner_id IN (SELECT p.id FROM partners p WHERE p.user_id = auth.uid())));

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create estimate line items table
CREATE TABLE public.estimate_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage line items" ON public.estimate_line_items FOR ALL USING (estimate_id IN (SELECT id FROM estimates WHERE has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Team leads can manage line items" ON public.estimate_line_items FOR ALL USING (estimate_id IN (SELECT id FROM estimates WHERE has_role(auth.uid(), 'team_lead'::app_role)));
CREATE POLICY "Clients can view own line items" ON public.estimate_line_items FOR SELECT USING (estimate_id IN (SELECT id FROM estimates WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())));

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  job_id UUID REFERENCES public.jobs(id),
  estimate_id UUID REFERENCES public.estimates(id),
  invoice_number TEXT NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all invoices" ON public.invoices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads can manage all invoices" ON public.invoices FOR ALL USING (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Clients can view own invoices" ON public.invoices FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
CREATE POLICY "Partners can view client invoices" ON public.invoices FOR SELECT USING (client_id IN (SELECT c.id FROM clients c WHERE c.partner_id IN (SELECT p.id FROM partners p WHERE p.user_id = auth.uid())));

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for estimates and invoices
ALTER PUBLICATION supabase_realtime ADD TABLE public.estimates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
