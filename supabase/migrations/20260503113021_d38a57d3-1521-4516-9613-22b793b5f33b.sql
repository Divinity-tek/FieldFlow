
-- History/audit log for dispatch tickets
CREATE TABLE IF NOT EXISTS public.dispatch_ticket_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.dispatch_tickets(id) ON DELETE CASCADE,
  changed_by UUID,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_ticket_history_ticket
  ON public.dispatch_ticket_history(ticket_id, created_at DESC);

ALTER TABLE public.dispatch_ticket_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all ticket history"
  ON public.dispatch_ticket_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordinators can view all ticket history"
  ON public.dispatch_ticket_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'associate_coordinator'::app_role));

CREATE POLICY "Team leads can view all ticket history"
  ON public.dispatch_ticket_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'team_lead'::app_role));

CREATE POLICY "Clients can view history of own tickets"
  ON public.dispatch_ticket_history FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (
      SELECT t.id FROM public.dispatch_tickets t
      JOIN public.clients c ON c.id = t.client_id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Engineers can view history of own tickets"
  ON public.dispatch_ticket_history FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (
      SELECT t.id FROM public.dispatch_tickets t
      JOIN public.engineers e ON e.id = t.engineer_id
      WHERE e.user_id = auth.uid()
    )
  );

-- Inserts only via trigger (no direct inserts)
CREATE POLICY "No direct inserts"
  ON public.dispatch_ticket_history FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Trigger function: log status, priority, engineer_id, engineer_notes changes
CREATE OR REPLACE FUNCTION public.log_dispatch_ticket_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.dispatch_ticket_history (ticket_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'status', OLD.status, NEW.status);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.dispatch_ticket_history (ticket_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'priority', OLD.priority, NEW.priority);
  END IF;
  IF NEW.engineer_id IS DISTINCT FROM OLD.engineer_id THEN
    INSERT INTO public.dispatch_ticket_history (ticket_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'engineer_id', OLD.engineer_id::text, NEW.engineer_id::text);
  END IF;
  IF NEW.engineer_notes IS DISTINCT FROM OLD.engineer_notes THEN
    INSERT INTO public.dispatch_ticket_history (ticket_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'engineer_notes', OLD.engineer_notes, NEW.engineer_notes);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_dispatch_ticket_changes ON public.dispatch_tickets;
CREATE TRIGGER trg_log_dispatch_ticket_changes
  AFTER UPDATE ON public.dispatch_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_dispatch_ticket_changes();
