
-- ============================================================
-- VENDORS DIRECTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  tax_id text,
  default_currency text NOT NULL DEFAULT 'USD',
  default_payment_terms text DEFAULT 'Net 30',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors USING gin (to_tsvector('simple', name));
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'));
CREATE POLICY "Authenticated read vendors" ON public.vendors
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- EXTEND PURCHASE_ORDERS
-- ============================================================
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS fx_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_code text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS receive_status text NOT NULL DEFAULT 'unreceived',
  ADD COLUMN IF NOT EXISTS ordered_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS vendor_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_invoice_total numeric,
  ADD COLUMN IF NOT EXISTS vendor_invoice_number text,
  ADD COLUMN IF NOT EXISTS three_way_match_status text DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_po_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_share_token ON public.purchase_orders(vendor_share_token);

-- ============================================================
-- VENDOR ITEM PRICE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  item_description text NOT NULL,
  unit_price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  quantity numeric NOT NULL DEFAULT 1,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vph_vendor ON public.vendor_price_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vph_item ON public.vendor_price_history(lower(item_description));
ALTER TABLE public.vendor_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage vph" ON public.vendor_price_history
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'));
CREATE POLICY "Authenticated read vph" ON public.vendor_price_history
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PO RECEIPTS (receiving events)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.po_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  received_by uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  -- items: [{ description, quantity_received, condition, inventory_item_id, discrepancy_note }]
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  is_partial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_receipts_po ON public.po_receipts(po_id);
ALTER TABLE public.po_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage po_receipts" ON public.po_receipts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'));
CREATE POLICY "Authenticated read po_receipts" ON public.po_receipts
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PO APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.po_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 1,
  required_role text NOT NULL DEFAULT 'team_lead',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  approver_id uuid,
  decided_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_approvals_po ON public.po_approvals(po_id);
ALTER TABLE public.po_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage po_approvals" ON public.po_approvals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'));
CREATE POLICY "Authenticated read po_approvals" ON public.po_approvals
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PO AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.po_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL, -- created | status_changed | approved | rejected | received | edited | sent_to_vendor | acknowledged
  field text,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_audit_po ON public.po_audit_log(po_id);
ALTER TABLE public.po_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage po_audit" ON public.po_audit_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'));
CREATE POLICY "Authenticated read po_audit" ON public.po_audit_log
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PO ACCOUNTING ENTRIES (outgoing payments tied to a PO)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.po_accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'expense', -- expense | refund | adjustment
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  fx_rate numeric NOT NULL DEFAULT 1,
  payment_method text,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_acct_po ON public.po_accounting_entries(po_id);
ALTER TABLE public.po_accounting_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage po_accounting" ON public.po_accounting_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead'));
CREATE POLICY "Authenticated read po_accounting" ON public.po_accounting_entries
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- AUDIT TRIGGER on purchase_orders
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_po_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.po_audit_log(po_id, actor_id, action, new_value)
    VALUES (NEW.id, v_actor, 'created', NEW.status);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.po_audit_log(po_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'status_changed', 'status', OLD.status, NEW.status);
    -- maintain timestamps
    IF NEW.status = 'ordered' AND NEW.ordered_at IS NULL THEN NEW.ordered_at := now(); END IF;
    IF NEW.status = 'received' AND NEW.received_at IS NULL THEN NEW.received_at := now(); END IF;
    IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  END IF;
  IF NEW.total IS DISTINCT FROM OLD.total THEN
    INSERT INTO public.po_audit_log(po_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'edited', 'total', OLD.total::text, NEW.total::text);
  END IF;
  IF NEW.vendor_acknowledged_at IS DISTINCT FROM OLD.vendor_acknowledged_at AND NEW.vendor_acknowledged_at IS NOT NULL THEN
    INSERT INTO public.po_audit_log(po_id, actor_id, action, note)
    VALUES (NEW.id, v_actor, 'acknowledged', 'Vendor acknowledged via portal');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_audit_ins ON public.purchase_orders;
DROP TRIGGER IF EXISTS trg_po_audit_upd ON public.purchase_orders;
CREATE TRIGGER trg_po_audit_ins AFTER INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_po_changes();
CREATE TRIGGER trg_po_audit_upd BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_po_changes();

-- ============================================================
-- RECEIVE TRIGGER: increase inventory + recompute receive_status + audit
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_po_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_inv_id uuid;
  v_qty numeric;
  v_total_ordered numeric := 0;
  v_total_received numeric := 0;
BEGIN
  -- 1) Bump inventory quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    v_inv_id := NULLIF(v_item->>'inventory_item_id','')::uuid;
    v_qty := COALESCE((v_item->>'quantity_received')::numeric, 0);
    IF v_inv_id IS NOT NULL AND v_qty > 0 THEN
      UPDATE public.inventory_items
         SET quantity = quantity + v_qty::int,
             updated_at = now()
       WHERE id = v_inv_id;
    END IF;
  END LOOP;

  -- 2) Recompute receive_status on the PO
  SELECT COALESCE(SUM((it->>'quantity')::numeric), 0)
    INTO v_total_ordered
    FROM purchase_orders po, jsonb_array_elements(po.items) it
   WHERE po.id = NEW.po_id;

  SELECT COALESCE(SUM((it->>'quantity_received')::numeric), 0)
    INTO v_total_received
    FROM po_receipts r, jsonb_array_elements(r.items) it
   WHERE r.po_id = NEW.po_id;

  UPDATE public.purchase_orders
     SET receive_status = CASE
           WHEN v_total_received <= 0 THEN 'unreceived'
           WHEN v_total_received >= v_total_ordered THEN 'fully_received'
           ELSE 'partially_received'
         END,
         received_at = CASE
           WHEN v_total_received >= v_total_ordered THEN now()
           ELSE received_at
         END
   WHERE id = NEW.po_id;

  -- 3) Audit
  INSERT INTO public.po_audit_log(po_id, actor_id, action, note)
  VALUES (NEW.po_id, v_actor, 'received',
          format('Received %s items (%s)', jsonb_array_length(NEW.items),
                 CASE WHEN v_total_received >= v_total_ordered THEN 'full' ELSE 'partial' END));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_apply_receipt ON public.po_receipts;
CREATE TRIGGER trg_po_apply_receipt AFTER INSERT ON public.po_receipts
  FOR EACH ROW EXECUTE FUNCTION public.apply_po_receipt();

-- ============================================================
-- 3-WAY MATCH HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION public.po_three_way_match(_po_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po RECORD;
  v_received numeric := 0;
  v_ordered numeric := 0;
BEGIN
  SELECT * INTO v_po FROM purchase_orders WHERE id = _po_id;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;

  SELECT COALESCE(SUM((it->>'quantity')::numeric), 0)
    INTO v_ordered
    FROM jsonb_array_elements(v_po.items) it;

  SELECT COALESCE(SUM((it->>'quantity_received')::numeric), 0)
    INTO v_received
    FROM po_receipts r, jsonb_array_elements(r.items) it
   WHERE r.po_id = _po_id;

  IF v_po.vendor_invoice_total IS NULL THEN RETURN 'awaiting_invoice'; END IF;
  IF v_received < v_ordered THEN RETURN 'awaiting_receipt'; END IF;
  IF abs(COALESCE(v_po.vendor_invoice_total,0) - COALESCE(v_po.total,0)) > 0.01 THEN RETURN 'amount_mismatch'; END IF;
  RETURN 'matched';
END;
$$;

-- ============================================================
-- VENDOR PORTAL: secure read by share token
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_po_by_share_token(_token text)
RETURNS TABLE (
  id uuid, po_number text, vendor_name text, vendor_email text,
  status text, items jsonb, subtotal numeric, tax_amount numeric,
  shipping_cost numeric, total numeric, currency text,
  expected_delivery date, notes text, vendor_acknowledged_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, po_number, vendor_name, vendor_email,
         status, items, subtotal, tax_amount,
         shipping_cost, total, currency,
         expected_delivery, notes, vendor_acknowledged_at, created_at
  FROM public.purchase_orders
  WHERE vendor_share_token = _token AND vendor_share_token IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_po_by_token(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.purchase_orders
     SET vendor_acknowledged_at = COALESCE(vendor_acknowledged_at, now())
   WHERE vendor_share_token = _token AND vendor_share_token IS NOT NULL;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_po_by_share_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.acknowledge_po_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_po_by_share_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_po_by_token(text) TO anon, authenticated;
