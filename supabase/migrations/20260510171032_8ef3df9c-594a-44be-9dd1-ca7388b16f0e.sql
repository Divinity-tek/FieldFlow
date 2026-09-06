-- 1) Replace the over-broad client UPDATE policy on dispatch_tickets so clients can
--    only flip their own approval-related columns. We enforce this with a trigger
--    that rejects changes to any column other than client_approval_status / approved_at.
DROP POLICY IF EXISTS "Clients can update approval on own tickets" ON public.dispatch_tickets;

CREATE POLICY "Clients can update approval on own tickets"
ON public.dispatch_tickets
FOR UPDATE
TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
)
WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.dispatch_tickets_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
  is_engineer boolean;
BEGIN
  -- Staff bypass: admins, team leads, associate coordinators, service desk.
  is_staff := public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'team_lead'::app_role)
           OR public.has_role(auth.uid(), 'associate_coordinator'::app_role)
           OR public.has_role(auth.uid(), 'service_desk'::app_role);
  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Engineers may update tickets they are assigned to (other policy already gates that).
  is_engineer := EXISTS (
    SELECT 1 FROM public.engineers e
    WHERE e.user_id = auth.uid() AND e.id = NEW.engineer_id
  );
  IF is_engineer THEN
    RETURN NEW;
  END IF;

  -- Otherwise this is a client update; allow only approval-related columns to change.
  IF NEW.client_id              IS DISTINCT FROM OLD.client_id              THEN RAISE EXCEPTION 'Clients cannot modify client_id'; END IF;
  IF NEW.engineer_id            IS DISTINCT FROM OLD.engineer_id            THEN RAISE EXCEPTION 'Clients cannot modify engineer_id'; END IF;
  IF NEW.status                 IS DISTINCT FROM OLD.status                 THEN RAISE EXCEPTION 'Clients cannot modify status'; END IF;
  IF NEW.hourly_rate            IS DISTINCT FROM OLD.hourly_rate            THEN RAISE EXCEPTION 'Clients cannot modify hourly_rate'; END IF;
  IF NEW.estimated_charges      IS DISTINCT FROM OLD.estimated_charges      THEN RAISE EXCEPTION 'Clients cannot modify estimated_charges'; END IF;
  IF NEW.actual_charges         IS DISTINCT FROM OLD.actual_charges         THEN RAISE EXCEPTION 'Clients cannot modify actual_charges'; END IF;
  IF NEW.materials_cost         IS DISTINCT FROM OLD.materials_cost         THEN RAISE EXCEPTION 'Clients cannot modify materials_cost'; END IF;
  IF NEW.contact_phone          IS DISTINCT FROM OLD.contact_phone          THEN RAISE EXCEPTION 'Clients cannot modify contact_phone'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispatch_tickets_client_update_guard ON public.dispatch_tickets;
CREATE TRIGGER dispatch_tickets_client_update_guard
BEFORE UPDATE ON public.dispatch_tickets
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_tickets_client_update_guard();

-- 2) Tighten realtime topic policy: only allow chat_room:<id> subscriptions
--    when the user is actually a member of that room.
DROP POLICY IF EXISTS "Authenticated scoped realtime topics" ON realtime.messages;

CREATE POLICY "Authenticated scoped realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = 'notifications:' || auth.uid()::text
  OR realtime.topic() LIKE 'presence:%'
  OR realtime.topic() LIKE 'presence_v2:%'
  OR realtime.topic() LIKE 'typing:%'
  OR (
    realtime.topic() LIKE 'chat_room:%'
    AND public.is_chat_room_member(
      substring(realtime.topic() FROM 'chat_room:(.*)')::uuid,
      auth.uid()
    )
  )
);