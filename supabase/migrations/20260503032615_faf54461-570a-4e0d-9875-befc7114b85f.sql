-- =========================================================
-- 1. INVOICES — bring to parity with estimates
-- =========================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id),
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branding_logo_url text,
  ADD COLUMN IF NOT EXISTS branding_primary_color text,
  ADD COLUMN IF NOT EXISTS branding_accent_color text,
  ADD COLUMN IF NOT EXISTS branding_footer_text text,
  ADD COLUMN IF NOT EXISTS branding_company_name text,
  ADD COLUMN IF NOT EXISTS dispatch_nbd_tm numeric,
  ADD COLUMN IF NOT EXISTS dispatch_hourly numeric,
  ADD COLUMN IF NOT EXISTS dispatch_half_day numeric,
  ADD COLUMN IF NOT EXISTS dispatch_full_day numeric,
  ADD COLUMN IF NOT EXISTS dispatch_remarks text,
  ADD COLUMN IF NOT EXISTS estimate_link_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric;

-- =========================================================
-- 2. CONFIGURABLE DOUBLE TAX (estimates + invoices)
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.tax_mode AS ENUM ('single','dual_split','compound','per_line');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS tax_mode public.tax_mode NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS tax1_label text NOT NULL DEFAULT 'Tax',
  ADD COLUMN IF NOT EXISTS tax2_label text NOT NULL DEFAULT 'Tax 2',
  ADD COLUMN IF NOT EXISTS tax2_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax2_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tax_mode public.tax_mode NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS tax1_label text NOT NULL DEFAULT 'Tax',
  ADD COLUMN IF NOT EXISTS tax2_label text NOT NULL DEFAULT 'Tax 2',
  ADD COLUMN IF NOT EXISTS tax2_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax2_amount numeric NOT NULL DEFAULT 0;

-- New records default to compound
ALTER TABLE public.estimates ALTER COLUMN tax_mode SET DEFAULT 'compound';
ALTER TABLE public.invoices  ALTER COLUMN tax_mode SET DEFAULT 'compound';

ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS tax1_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax2_rate numeric NOT NULL DEFAULT 0;

-- =========================================================
-- 3. INVOICE LINE ITEMS (mirror estimate_line_items)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  tax1_rate numeric NOT NULL DEFAULT 0,
  tax2_rate numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage invoice line items" ON public.invoice_line_items;
CREATE POLICY "Admins manage invoice line items"
ON public.invoice_line_items FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Team leads manage invoice line items" ON public.invoice_line_items;
CREATE POLICY "Team leads manage invoice line items"
ON public.invoice_line_items FOR ALL
USING (public.has_role(auth.uid(), 'team_lead'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'team_lead'::public.app_role));

DROP POLICY IF EXISTS "Clients view their invoice line items" ON public.invoice_line_items;
CREATE POLICY "Clients view their invoice line items"
ON public.invoice_line_items FOR SELECT
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Partners view client invoice line items" ON public.invoice_line_items;
CREATE POLICY "Partners view client invoice line items"
ON public.invoice_line_items FOR SELECT
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    JOIN public.partners p ON p.id = c.partner_id
    WHERE p.user_id = auth.uid()
  )
);

-- =========================================================
-- 4. RECEIPTS (paid-invoice receipts AND standalone)
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.receipt_kind AS ENUM ('invoice_payment','standalone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS public.receipts_number_seq;

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  kind public.receipt_kind NOT NULL DEFAULT 'standalone',
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id),
  partner_id uuid REFERENCES public.partners(id),
  payer_name text,
  payer_email text,
  payment_method text,
  payment_reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_mode public.tax_mode NOT NULL DEFAULT 'single',
  tax1_label text NOT NULL DEFAULT 'Tax',
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  tax2_label text NOT NULL DEFAULT 'Tax 2',
  tax2_rate numeric NOT NULL DEFAULT 0,
  tax2_amount numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  notes text,
  branding_logo_url text,
  branding_primary_color text,
  branding_accent_color text,
  branding_footer_text text,
  branding_company_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice ON public.receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_client ON public.receipts(client_id);

CREATE OR REPLACE FUNCTION public.set_receipt_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := 'RCP-' || LPAD(nextval('public.receipts_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_receipt_number ON public.receipts;
CREATE TRIGGER trg_set_receipt_number
BEFORE INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.set_receipt_number();

DROP TRIGGER IF EXISTS trg_receipts_updated_at ON public.receipts;
CREATE TRIGGER trg_receipts_updated_at
BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.receipt_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipt_line_items_receipt ON public.receipt_line_items(receipt_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_line_items ENABLE ROW LEVEL SECURITY;

-- Receipts policies
DROP POLICY IF EXISTS "Admins manage receipts" ON public.receipts;
CREATE POLICY "Admins manage receipts" ON public.receipts FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Team leads manage receipts" ON public.receipts;
CREATE POLICY "Team leads manage receipts" ON public.receipts FOR ALL
USING (public.has_role(auth.uid(), 'team_lead'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'team_lead'::public.app_role));

DROP POLICY IF EXISTS "Clients view own receipts" ON public.receipts;
CREATE POLICY "Clients view own receipts" ON public.receipts FOR SELECT
USING (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Partners view client receipts" ON public.receipts;
CREATE POLICY "Partners view client receipts" ON public.receipts FOR SELECT
USING (client_id IN (
  SELECT c.id FROM public.clients c
  JOIN public.partners p ON p.id = c.partner_id
  WHERE p.user_id = auth.uid()
));

-- Receipt line items policies (mirror)
DROP POLICY IF EXISTS "Admins manage receipt line items" ON public.receipt_line_items;
CREATE POLICY "Admins manage receipt line items" ON public.receipt_line_items FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Team leads manage receipt line items" ON public.receipt_line_items;
CREATE POLICY "Team leads manage receipt line items" ON public.receipt_line_items FOR ALL
USING (public.has_role(auth.uid(), 'team_lead'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'team_lead'::public.app_role));

DROP POLICY IF EXISTS "Clients view receipt line items" ON public.receipt_line_items;
CREATE POLICY "Clients view receipt line items" ON public.receipt_line_items FOR SELECT
USING (receipt_id IN (
  SELECT r.id FROM public.receipts r
  JOIN public.clients c ON c.id = r.client_id
  WHERE c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Partners view receipt line items" ON public.receipt_line_items;
CREATE POLICY "Partners view receipt line items" ON public.receipt_line_items FOR SELECT
USING (receipt_id IN (
  SELECT r.id FROM public.receipts r
  JOIN public.clients c ON c.id = r.client_id
  JOIN public.partners p ON p.id = c.partner_id
  WHERE p.user_id = auth.uid()
));

-- =========================================================
-- 5. CONVERT ESTIMATE → INVOICE
-- =========================================================
CREATE OR REPLACE FUNCTION public.convert_estimate_to_invoice(
  _estimate_id uuid,
  _due_date date DEFAULT NULL,
  _keep_linked boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est RECORD;
  v_invoice_id uuid;
  v_number text;
BEGIN
  SELECT * INTO v_est FROM public.estimates WHERE id = _estimate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estimate not found'; END IF;

  v_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);

  INSERT INTO public.invoices (
    client_id, partner_id, job_id, estimate_id, invoice_number, status,
    due_date, title, currency, subtotal, discount_percent, discount_amount,
    tax_mode, tax1_label, tax_rate, tax_amount, tax2_label, tax2_rate, tax2_amount,
    total, notes,
    branding_logo_url, branding_primary_color, branding_accent_color,
    branding_footer_text, branding_company_name,
    dispatch_nbd_tm, dispatch_hourly, dispatch_half_day, dispatch_full_day, dispatch_remarks,
    estimate_link_active, balance_due, created_by
  ) VALUES (
    v_est.client_id, v_est.partner_id, v_est.job_id, v_est.id, v_number, 'draft',
    COALESCE(_due_date, (now() + interval '30 days')::date),
    v_est.title, v_est.currency, v_est.subtotal, v_est.discount_percent, v_est.discount_amount,
    v_est.tax_mode, v_est.tax1_label, v_est.tax_rate, v_est.tax_amount,
    v_est.tax2_label, v_est.tax2_rate, v_est.tax2_amount,
    v_est.total, v_est.notes,
    v_est.branding_logo_url, v_est.branding_primary_color, v_est.branding_accent_color,
    v_est.branding_footer_text, v_est.branding_company_name,
    v_est.dispatch_nbd_tm, v_est.dispatch_hourly, v_est.dispatch_half_day, v_est.dispatch_full_day, v_est.dispatch_remarks,
    COALESCE(_keep_linked, true), v_est.total, auth.uid()
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_line_items
    (invoice_id, description, quantity, unit_price, total, tax1_rate, tax2_rate, sort_order)
  SELECT v_invoice_id, description, quantity, unit_price, total, tax1_rate, tax2_rate, sort_order
  FROM public.estimate_line_items
  WHERE estimate_id = _estimate_id;

  RETURN v_invoice_id;
END $$;

-- Keep balance_due in sync
CREATE OR REPLACE FUNCTION public.sync_invoice_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.balance_due := COALESCE(NEW.total, 0) - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_balance ON public.invoices;
CREATE TRIGGER trg_invoice_balance
BEFORE INSERT OR UPDATE OF total, amount_paid ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_balance();