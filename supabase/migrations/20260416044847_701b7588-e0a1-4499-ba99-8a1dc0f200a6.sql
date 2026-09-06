
-- Jobs: view + update
CREATE POLICY "Associate coordinators can view all jobs"
ON public.jobs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

CREATE POLICY "Associate coordinators can update jobs"
ON public.jobs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Dispatch tickets: full access
CREATE POLICY "Associate coordinators can manage dispatch tickets"
ON public.dispatch_tickets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Clients: view
CREATE POLICY "Associate coordinators can view clients"
ON public.clients FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Client communications: full
CREATE POLICY "Associate coordinators can manage communications"
ON public.client_communications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Tickets: full
CREATE POLICY "Associate coordinators can manage tickets"
ON public.tickets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- SLA breaches: view + update
CREATE POLICY "Associate coordinators can view SLA breaches"
ON public.sla_breaches FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

CREATE POLICY "Associate coordinators can update SLA breaches"
ON public.sla_breaches FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Engineers: view
CREATE POLICY "Associate coordinators can view engineers"
ON public.engineers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Engineer availability: view
CREATE POLICY "Associate coordinators can view availability"
ON public.engineer_availability FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Estimates: view
CREATE POLICY "Associate coordinators can view estimates"
ON public.estimates FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Invoices: view
CREATE POLICY "Associate coordinators can view invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Follow-up reminders: full
CREATE POLICY "Associate coordinators can manage reminders"
ON public.follow_up_reminders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Notifications: full
CREATE POLICY "Associate coordinators can manage own notifications"
ON public.notifications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));

-- Engineer ratings: view
CREATE POLICY "Associate coordinators can view ratings"
ON public.engineer_ratings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'associate_coordinator'::app_role));
