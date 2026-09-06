
-- Service Agreements / Maintenance Contracts
CREATE TABLE public.service_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  agreement_type text NOT NULL DEFAULT 'maintenance',
  status text NOT NULL DEFAULT 'active',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  renewal_type text NOT NULL DEFAULT 'auto',
  billing_frequency text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 0,
  visits_included integer NOT NULL DEFAULT 0,
  visits_used integer NOT NULL DEFAULT 0,
  terms text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage service_agreements" ON public.service_agreements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Timesheets
CREATE TABLE public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id uuid REFERENCES public.engineers(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  total_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  total_pay numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage timesheets" ON public.timesheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Custom Forms / Checklists
CREATE TABLE public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'inspection',
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage form_templates" ON public.form_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.form_templates(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  engineer_id uuid REFERENCES public.engineers(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage form_submissions" ON public.form_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Purchase Orders
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL DEFAULT ('PO-' || LPAD(FLOOR(RANDOM() * 100000)::text, 5, '0')),
  vendor_name text NOT NULL,
  vendor_email text,
  vendor_phone text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  expected_delivery date,
  notes text,
  approved_by text,
  approved_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fleet Management
CREATE TABLE public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_name text NOT NULL,
  license_plate text NOT NULL,
  make text,
  model text,
  year integer,
  vin text,
  assigned_engineer_id uuid REFERENCES public.engineers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  fuel_type text NOT NULL DEFAULT 'gasoline',
  odometer_reading numeric NOT NULL DEFAULT 0,
  insurance_expiry date,
  registration_expiry date,
  next_service_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage fleet_vehicles" ON public.fleet_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.fleet_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE NOT NULL,
  log_type text NOT NULL DEFAULT 'fuel',
  date date NOT NULL DEFAULT CURRENT_DATE,
  odometer numeric,
  fuel_gallons numeric,
  fuel_cost numeric,
  maintenance_type text,
  maintenance_cost numeric,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fleet_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage fleet_logs" ON public.fleet_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
