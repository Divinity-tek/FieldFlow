-- Helpdesk tickets (table is `tickets`)
CREATE POLICY "Service desk can view tickets"
  ON public.tickets FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));

CREATE POLICY "Service desk can create tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'service_desk'));

CREATE POLICY "Service desk can update tickets"
  ON public.tickets FOR UPDATE
  USING (public.has_role(auth.uid(), 'service_desk'));

-- Dispatch tickets: read-only
CREATE POLICY "Service desk can view dispatch tickets"
  ON public.dispatch_tickets FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));

-- Dispatch ticket history: read + insert notes
CREATE POLICY "Service desk can view dispatch ticket history"
  ON public.dispatch_ticket_history FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));

CREATE POLICY "Service desk can add dispatch ticket notes"
  ON public.dispatch_ticket_history FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'service_desk') AND changed_by = auth.uid());

-- Jobs: read + intake create (cannot set engineer_id)
CREATE POLICY "Service desk can view jobs"
  ON public.jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));

CREATE POLICY "Service desk can create jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'service_desk') AND engineer_id IS NULL);

-- Trigger to prevent service-desk users from later setting engineer_id via any path
CREATE OR REPLACE FUNCTION public.block_service_desk_engineer_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'service_desk')
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'team_lead')
     AND NOT public.has_role(auth.uid(), 'associate_coordinator')
     AND NEW.engineer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Service Desk agents cannot assign engineers to jobs'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_service_desk_engineer_assign ON public.jobs;
CREATE TRIGGER trg_block_service_desk_engineer_assign
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.block_service_desk_engineer_assign();

-- Clients & addresses for lookup
CREATE POLICY "Service desk can view clients"
  ON public.clients FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));

CREATE POLICY "Service desk can view client addresses"
  ON public.client_addresses FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));

CREATE POLICY "Service desk can view profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));

-- Invoices: read-only for billing questions
CREATE POLICY "Service desk can view invoices"
  ON public.invoices FOR SELECT
  USING (public.has_role(auth.uid(), 'service_desk'));