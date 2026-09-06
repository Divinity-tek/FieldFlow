ALTER TABLE public.estimate_line_items ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS unit text;

CREATE OR REPLACE FUNCTION public.convert_estimate_to_invoice(_estimate_id uuid, _due_date date DEFAULT NULL::date, _keep_linked boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (invoice_id, description, quantity, unit_price, total, tax1_rate, tax2_rate, sort_order, unit)
  SELECT v_invoice_id, description, quantity, unit_price, total, tax1_rate, tax2_rate, sort_order, unit
  FROM public.estimate_line_items
  WHERE estimate_id = _estimate_id;

  RETURN v_invoice_id;
END $function$;