
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_resolution_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_resolution_due ON public.tickets(sla_resolution_due_at) WHERE status NOT IN ('resolved','closed');

CREATE TABLE IF NOT EXISTS public.ticket_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket ON public.ticket_activity_log(ticket_id, created_at DESC);

ALTER TABLE public.ticket_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view ticket activity" ON public.ticket_activity_log;
CREATE POLICY "Staff can view ticket activity"
ON public.ticket_activity_log FOR SELECT
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'team_lead')
  OR public.has_role(auth.uid(),'service_desk')
  OR public.has_role(auth.uid(),'associate_coordinator')
);

DROP POLICY IF EXISTS "Staff can insert ticket activity" ON public.ticket_activity_log;
CREATE POLICY "Staff can insert ticket activity"
ON public.ticket_activity_log FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'team_lead')
  OR public.has_role(auth.uid(),'service_desk')
  OR public.has_role(auth.uid(),'associate_coordinator')
);

-- SLA + workflow trigger
CREATE OR REPLACE FUNCTION public.tickets_workflow_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp_min int;
  v_resol_min int;
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sla_response_due_at IS NULL OR NEW.sla_resolution_due_at IS NULL THEN
      v_resp_min := CASE NEW.priority::text
        WHEN 'urgent' THEN 30
        WHEN 'high'   THEN 60
        WHEN 'medium' THEN 240
        ELSE 480 END;
      v_resol_min := CASE NEW.priority::text
        WHEN 'urgent' THEN 120
        WHEN 'high'   THEN 240
        WHEN 'medium' THEN 1440
        ELSE 4320 END;
      NEW.sla_response_due_at  := COALESCE(NEW.sla_response_due_at,  NEW.created_at + make_interval(mins => v_resp_min));
      NEW.sla_resolution_due_at:= COALESCE(NEW.sla_resolution_due_at, NEW.created_at + make_interval(mins => v_resol_min));
    END IF;
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
      IF NEW.status::text = 'new' THEN NEW.status := 'assigned'; END IF;
    END IF;
    INSERT INTO public.ticket_activity_log(ticket_id, actor_id, action, new_value)
    VALUES (NEW.id, v_actor, 'created', NEW.status::text);
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    NEW.assigned_at := CASE WHEN NEW.assigned_to IS NULL THEN NULL ELSE now() END;
    IF NEW.assigned_to IS NOT NULL AND NEW.status::text IN ('new','open') THEN
      NEW.status := 'assigned';
    END IF;
    INSERT INTO public.ticket_activity_log(ticket_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'assigned', 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'resolved' AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    IF NEW.status::text = 'closed'   AND NEW.closed_at   IS NULL THEN NEW.closed_at   := now(); END IF;
    IF NEW.status::text = 'in_progress' AND NEW.first_response_at IS NULL THEN NEW.first_response_at := now(); END IF;
    INSERT INTO public.ticket_activity_log(ticket_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'status_changed', 'status', OLD.status::text, NEW.status::text);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.ticket_activity_log(ticket_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'priority_changed', 'priority', OLD.priority::text, NEW.priority::text);
  END IF;

  -- SLA breach flags
  IF NEW.first_response_at IS NULL AND NEW.sla_response_due_at IS NOT NULL AND now() > NEW.sla_response_due_at THEN
    NEW.sla_response_breached := true;
  END IF;
  IF NEW.status::text NOT IN ('resolved','closed')
     AND NEW.sla_resolution_due_at IS NOT NULL AND now() > NEW.sla_resolution_due_at THEN
    NEW.sla_resolution_breached := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_workflow ON public.tickets;
CREATE TRIGGER trg_tickets_workflow
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tickets_workflow_trigger();
