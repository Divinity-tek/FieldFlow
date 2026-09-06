
-- =========================================================
-- 1) voice_notes
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view voice notes" ON public.voice_notes;
CREATE POLICY "Engineers view own voice notes" ON public.voice_notes
  FOR SELECT TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));
CREATE POLICY "Staff view all voice notes" ON public.voice_notes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 2) client_assets
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view assets" ON public.client_assets;
CREATE POLICY "Client members view assets" ON public.client_assets
  FOR SELECT TO authenticated
  USING (public.is_client_member(client_id, auth.uid()));
CREATE POLICY "Partners view client assets" ON public.client_assets
  FOR SELECT TO authenticated
  USING (public.can_partner_access_client(client_id, auth.uid()));
CREATE POLICY "Staff view all client assets" ON public.client_assets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 3) asset_service_history
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view asset history" ON public.asset_service_history;
CREATE POLICY "Engineers view own asset history" ON public.asset_service_history
  FOR SELECT TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));
CREATE POLICY "Client members view asset history" ON public.asset_service_history
  FOR SELECT TO authenticated
  USING (asset_id IN (
    SELECT id FROM public.client_assets ca
    WHERE public.is_client_member(ca.client_id, auth.uid())
       OR public.can_partner_access_client(ca.client_id, auth.uid())
  ));
CREATE POLICY "Staff view all asset history" ON public.asset_service_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 4) engineer_success_scores
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view success scores" ON public.engineer_success_scores;
CREATE POLICY "Engineers view own success score" ON public.engineer_success_scores
  FOR SELECT TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));
CREATE POLICY "Staff view all success scores" ON public.engineer_success_scores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 5) PO-related: po_audit_log, po_receipts, po_accounting_entries, po_approvals, vendor_price_history
-- =========================================================
DROP POLICY IF EXISTS "Authenticated read po_audit" ON public.po_audit_log;
CREATE POLICY "Staff read po_audit" ON public.po_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

DROP POLICY IF EXISTS "Authenticated read po_receipts" ON public.po_receipts;
CREATE POLICY "Staff read po_receipts" ON public.po_receipts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

DROP POLICY IF EXISTS "Authenticated read po_accounting" ON public.po_accounting_entries;
CREATE POLICY "Staff read po_accounting" ON public.po_accounting_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

DROP POLICY IF EXISTS "Authenticated read po_approvals" ON public.po_approvals;
CREATE POLICY "Staff read po_approvals" ON public.po_approvals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

DROP POLICY IF EXISTS "Authenticated read vph" ON public.vendor_price_history;
CREATE POLICY "Staff read vendor price history" ON public.vendor_price_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 6) recurring_job_templates
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view recurring templates" ON public.recurring_job_templates;
CREATE POLICY "Staff view recurring templates" ON public.recurring_job_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 7) inventory_items
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view inventory" ON public.inventory_items;
CREATE POLICY "Staff view inventory" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 8) engineer_availability
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view availability" ON public.engineer_availability;
CREATE POLICY "Engineers view own availability" ON public.engineer_availability
  FOR SELECT TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));
CREATE POLICY "Staff view all availability" ON public.engineer_availability
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 9) engineer_certifications
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view certifications" ON public.engineer_certifications;
CREATE POLICY "Engineers view own certifications" ON public.engineer_certifications
  FOR SELECT TO authenticated
  USING (engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid()));
CREATE POLICY "Staff view all certifications" ON public.engineer_certifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- =========================================================
-- 10) partner-logos storage bucket: restrict mutations to staff
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can upload partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete partner logos" ON storage.objects;

CREATE POLICY "Staff can upload partner logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'partner-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
);
CREATE POLICY "Staff can update partner logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'partner-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
);
CREATE POLICY "Staff can delete partner logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'partner-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
);

-- =========================================================
-- 11) notifications: restrict INSERT
-- =========================================================
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Staff or self can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
  );
