
DO $$ BEGIN
  CREATE TYPE public.client_portal_role AS ENUM ('owner','approver','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.client_portal_role NOT NULL DEFAULT 'viewer',
  invited_email text,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON public.client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_user ON public.client_users(user_id);

CREATE OR REPLACE FUNCTION public.is_client_member(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = _client_id AND c.user_id = _user_id
    UNION
    SELECT 1 FROM public.client_users cu WHERE cu.client_id = _client_id AND cu.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.client_portal_role_of(_client_id uuid, _user_id uuid)
RETURNS public.client_portal_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.client_users
   WHERE client_id = _client_id AND user_id = _user_id
   ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'approver' THEN 2 ELSE 3 END
   LIMIT 1
$$;

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_users" ON public.client_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read own client_users" ON public.client_users FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Owners add client_users" ON public.client_users FOR INSERT TO authenticated
  WITH CHECK (public.client_portal_role_of(client_id, auth.uid()) = 'owner');
CREATE POLICY "Owners update client_users" ON public.client_users FOR UPDATE TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) = 'owner');
CREATE POLICY "Owners delete client_users" ON public.client_users FOR DELETE TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) = 'owner');
CREATE TRIGGER trg_client_users_updated BEFORE UPDATE ON public.client_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL, address_line text NOT NULL,
  city text, region text, postal_code text, country text,
  contact_name text, contact_phone text,
  is_default boolean NOT NULL DEFAULT false, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client ON public.client_addresses(client_id);
ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_addresses" ON public.client_addresses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read client_addresses" ON public.client_addresses FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Members write client_addresses" ON public.client_addresses FOR INSERT TO authenticated
  WITH CHECK (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'));
CREATE POLICY "Members update client_addresses" ON public.client_addresses FOR UPDATE TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'));
CREATE POLICY "Members delete client_addresses" ON public.client_addresses FOR DELETE TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) = 'owner');
CREATE TRIGGER trg_client_addresses_updated BEFORE UPDATE ON public.client_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL, email text, phone text, role text, notes text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON public.client_contacts(client_id);
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_contacts" ON public.client_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read client_contacts" ON public.client_contacts FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Members write client_contacts" ON public.client_contacts FOR ALL TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'))
  WITH CHECK (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'));
CREATE TRIGGER trg_client_contacts_updated BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  address_id uuid REFERENCES public.client_addresses(id) ON DELETE SET NULL,
  title text NOT NULL, description text, service_type text,
  priority text NOT NULL DEFAULT 'medium',
  desired_date date,
  status text NOT NULL DEFAULT 'submitted',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rrule text, recurrence_ends_on date,
  cancellation_policy_hours int NOT NULL DEFAULT 24,
  cancelled_at timestamptz, cancelled_reason text, rescheduled_at timestamptz,
  converted_job_id uuid, submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_requests_client ON public.client_service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_status ON public.client_service_requests(status);
ALTER TABLE public.client_service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_requests" ON public.client_service_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read client_requests" ON public.client_service_requests FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Members create client_requests" ON public.client_service_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Members update own client_requests" ON public.client_service_requests FOR UPDATE TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE TRIGGER trg_client_requests_updated BEFORE UPDATE ON public.client_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'card',
  brand text, last4 text, exp_month int, exp_year int, holder_name text,
  is_default boolean NOT NULL DEFAULT false,
  is_autopay boolean NOT NULL DEFAULT false,
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_pm_client ON public.client_payment_methods(client_id);
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_pm" ON public.client_payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members manage own pm" ON public.client_payment_methods FOR ALL TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'))
  WITH CHECK (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'));
CREATE TRIGGER trg_client_pm_updated BEFORE UPDATE ON public.client_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES public.client_payment_methods(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'succeeded',
  receipt_url text, external_ref text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_pmt_client ON public.client_invoice_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_pmt_invoice ON public.client_invoice_payments(invoice_id);
ALTER TABLE public.client_invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_payments" ON public.client_invoice_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read own payments" ON public.client_invoice_payments FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Members create payments" ON public.client_invoice_payments FOR INSERT TO authenticated
  WITH CHECK (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'));

CREATE TABLE IF NOT EXISTS public.client_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid,
  event_key text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_notif_default
  ON public.client_notification_prefs(client_id, event_key) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_notif_user
  ON public.client_notification_prefs(client_id, user_id, event_key) WHERE user_id IS NOT NULL;
ALTER TABLE public.client_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notif_prefs" ON public.client_notification_prefs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members manage notif_prefs" ON public.client_notification_prefs FOR ALL TO authenticated
  USING (public.is_client_member(client_id, auth.uid()))
  WITH CHECK (public.is_client_member(client_id, auth.uid()));
CREATE TRIGGER trg_client_notif_updated BEFORE UPDATE ON public.client_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_estimate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  decided_by uuid, decision text NOT NULL, comment text, signature_data text,
  decided_at timestamptz NOT NULL DEFAULT now(), ip text, user_agent text
);
CREATE INDEX IF NOT EXISTS idx_estimate_decisions_estimate ON public.client_estimate_decisions(estimate_id);
ALTER TABLE public.client_estimate_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read estimate_decisions" ON public.client_estimate_decisions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead')
         OR public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Approvers create estimate_decisions" ON public.client_estimate_decisions FOR INSERT TO authenticated
  WITH CHECK (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver')
              OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.client_job_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'client',
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobmsg_job ON public.client_job_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_jobmsg_client ON public.client_job_messages(client_id);
ALTER TABLE public.client_job_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage jobmsg" ON public.client_job_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read jobmsg" ON public.client_job_messages FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Members send jobmsg" ON public.client_job_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_client_member(client_id, auth.uid()) AND sender_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.client_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_id uuid, action text NOT NULL,
  entity_type text, entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_client ON public.client_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.client_audit_log(created_at);
ALTER TABLE public.client_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.client_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead')
         OR (public.is_client_member(client_id, auth.uid())
             AND public.client_portal_role_of(client_id, auth.uid()) = 'owner'));
CREATE POLICY "Anyone authenticated insert audit" ON public.client_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_client_member(client_id, auth.uid())
              OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'team_lead'));

CREATE TABLE IF NOT EXISTS public.client_portal_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  subdomain text UNIQUE,
  primary_color text, accent_color text, logo_url text,
  support_email text, support_phone text, welcome_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_portal_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage portal_branding" ON public.client_portal_branding FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read portal_branding" ON public.client_portal_branding FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Owners update portal_branding" ON public.client_portal_branding FOR UPDATE TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) = 'owner');
CREATE TRIGGER trg_portal_branding_updated BEFORE UPDATE ON public.client_portal_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_site_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  address_id uuid REFERENCES public.client_addresses(id) ON DELETE SET NULL,
  name text NOT NULL, category text, serial_number text,
  install_date date, warranty_until date, next_pm_at date,
  notes text, documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_assets_client ON public.client_site_assets(client_id);
ALTER TABLE public.client_site_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage site_assets" ON public.client_site_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_lead'));
CREATE POLICY "Members read site_assets" ON public.client_site_assets FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Owners write site_assets" ON public.client_site_assets FOR ALL TO authenticated
  USING (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'))
  WITH CHECK (public.client_portal_role_of(client_id, auth.uid()) IN ('owner','approver'));
CREATE TRIGGER trg_site_assets_updated BEFORE UPDATE ON public.client_site_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-attachments', 'portal-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read portal-attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'portal-attachments');
CREATE POLICY "Authenticated upload portal-attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'portal-attachments');
CREATE POLICY "Authenticated update own portal-attachments" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'portal-attachments' AND owner = auth.uid());
CREATE POLICY "Authenticated delete own portal-attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'portal-attachments' AND owner = auth.uid());
