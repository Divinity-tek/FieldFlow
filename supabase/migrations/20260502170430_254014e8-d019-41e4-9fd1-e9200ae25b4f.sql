CREATE TABLE public.estimate_notes_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_notes_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active notes templates"
  ON public.estimate_notes_templates FOR SELECT
  TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Admins/team leads can insert notes templates"
  ON public.estimate_notes_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Admins/team leads can update notes templates"
  ON public.estimate_notes_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Admins/team leads can delete notes templates"
  ON public.estimate_notes_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

CREATE TRIGGER trg_estimate_notes_templates_updated_at
  BEFORE UPDATE ON public.estimate_notes_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.estimate_notes_templates (label, content, sort_order) VALUES
('Standard Payment Terms (Net 30)', E'Payment Terms: Net 30 days from invoice date.\nLate payments are subject to a 1.5% monthly interest charge.\nAll prices are exclusive of applicable taxes unless stated otherwise.', 10),
('50% Deposit Required', E'Payment Terms: 50% deposit required upon acceptance of this estimate; balance due upon completion.\nWork will commence after deposit is received.\nAccepted payment methods: bank transfer, credit card.', 20),
('Milestone Billing', E'Payment Terms: Billed in milestones — 30% on project kickoff, 40% at midpoint review, 30% on final delivery.\nEach milestone invoice is due Net 15.', 30),
('Scope & Validity', E'Scope: This estimate covers the items listed above only. Any additional work will be quoted separately.\nValidity: This quote is valid for 30 days from the issue date.\nChanges to scope may affect pricing and timeline.', 40),
('Service & Warranty', E'Warranty: All workmanship is guaranteed for 90 days from completion.\nHardware components carry the manufacturer''s warranty.\nOn-site response within 4 business hours during contracted SLA windows.', 50),
('Cancellation Policy', E'Cancellation: Estimate may be cancelled in writing prior to work commencement at no charge.\nCancellation after work has begun will be billed for time and materials incurred to date.\nDeposits are non-refundable once project is scheduled.', 60);