-- ============ user_roles: prevent privilege escalation ============
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- ============ audit_logs: stop log poisoning ============
DROP POLICY IF EXISTS "Users insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users insert own audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============ clients: scope visibility ============
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clients;
CREATE POLICY "Privileged roles can view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team_lead'::app_role)
  OR has_role(auth.uid(), 'associate_coordinator'::app_role)
  OR auth.uid() = user_id
  OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
);
CREATE POLICY "Engineers view clients of their assigned jobs"
ON public.clients FOR SELECT TO authenticated
USING (
  id IN (
    SELECT j.client_id FROM public.jobs j
    JOIN public.engineers e ON e.id = j.engineer_id
    WHERE e.user_id = auth.uid()
  )
);

-- ============ engineers: scope visibility ============
DROP POLICY IF EXISTS "Authenticated can view engineers" ON public.engineers;
CREATE POLICY "Privileged roles can view engineers"
ON public.engineers FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team_lead'::app_role)
  OR has_role(auth.uid(), 'associate_coordinator'::app_role)
  OR auth.uid() = user_id
);
CREATE POLICY "Clients view engineers assigned to their jobs"
ON public.engineers FOR SELECT TO authenticated
USING (
  id IN (
    SELECT j.engineer_id FROM public.jobs j
    JOIN public.clients c ON c.id = j.client_id
    WHERE c.user_id = auth.uid() AND j.engineer_id IS NOT NULL
  )
);

-- ============ partners: scope visibility ============
DROP POLICY IF EXISTS "Authenticated can view partners" ON public.partners;
CREATE POLICY "Privileged roles can view partners"
ON public.partners FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team_lead'::app_role)
  OR auth.uid() = user_id
);

-- ============ timesheets ============
DROP POLICY IF EXISTS "Authenticated users can manage timesheets" ON public.timesheets;
CREATE POLICY "Admins manage all timesheets"
ON public.timesheets FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage all timesheets"
ON public.timesheets FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_lead'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Engineers manage own timesheets"
ON public.timesheets FOR ALL TO authenticated
USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()))
WITH CHECK (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

-- ============ purchase_orders ============
DROP POLICY IF EXISTS "Authenticated users can manage purchase_orders" ON public.purchase_orders;
CREATE POLICY "Admins manage purchase orders"
ON public.purchase_orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage purchase orders"
ON public.purchase_orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_lead'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));

-- ============ service_agreements ============
DROP POLICY IF EXISTS "Authenticated users can manage service_agreements" ON public.service_agreements;
CREATE POLICY "Admins manage service agreements"
ON public.service_agreements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage service agreements"
ON public.service_agreements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_lead'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Clients view own service agreements"
ON public.service_agreements FOR SELECT TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ============ fleet_vehicles ============
DROP POLICY IF EXISTS "Authenticated users can manage fleet_vehicles" ON public.fleet_vehicles;
CREATE POLICY "Admins manage fleet vehicles"
ON public.fleet_vehicles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage fleet vehicles"
ON public.fleet_vehicles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_lead'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Engineers view assigned vehicle"
ON public.fleet_vehicles FOR SELECT TO authenticated
USING (assigned_engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));

-- ============ fleet_logs ============
DROP POLICY IF EXISTS "Authenticated users can manage fleet_logs" ON public.fleet_logs;
CREATE POLICY "Admins manage fleet logs"
ON public.fleet_logs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage fleet logs"
ON public.fleet_logs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_lead'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));

-- ============ form_submissions ============
DROP POLICY IF EXISTS "Authenticated users can manage form_submissions" ON public.form_submissions;
CREATE POLICY "Admins manage form submissions"
ON public.form_submissions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage form submissions"
ON public.form_submissions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_lead'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));
CREATE POLICY "Engineers manage own form submissions"
ON public.form_submissions FOR ALL TO authenticated
USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()))
WITH CHECK (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));
CREATE POLICY "Clients view own form submissions"
ON public.form_submissions FOR SELECT TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ============ form_templates ============
DROP POLICY IF EXISTS "Authenticated users can manage form_templates" ON public.form_templates;
CREATE POLICY "Authenticated users can view active templates"
ON public.form_templates FOR SELECT TO authenticated
USING (is_active = true);
CREATE POLICY "Admins manage form templates"
ON public.form_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leads manage form templates"
ON public.form_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_lead'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_lead'::app_role));

-- ============ notifications: scope coordinator access ============
DROP POLICY IF EXISTS "Associate coordinators can manage own notifications" ON public.notifications;
CREATE POLICY "Coordinators manage own notifications"
ON public.notifications FOR ALL TO authenticated
USING (has_role(auth.uid(), 'associate_coordinator'::app_role) AND auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'associate_coordinator'::app_role) AND auth.uid() = user_id);

-- ============ Performance indexes ============
CREATE INDEX IF NOT EXISTS idx_jobs_engineer_id ON public.jobs(engineer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON public.jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_engineer_id ON public.dispatch_tickets(engineer_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_client_id ON public.dispatch_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_tickets_status ON public.dispatch_tickets(status);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room_id ON public.chat_room_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON public.chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_engineer_location_history_engineer_recorded ON public.engineer_location_history(engineer_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timesheets_engineer_date ON public.timesheets(engineer_id, date DESC);