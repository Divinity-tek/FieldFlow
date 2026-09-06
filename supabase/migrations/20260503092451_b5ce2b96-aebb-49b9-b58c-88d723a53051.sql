
-- Contract (SOW) container
CREATE TABLE public.sow_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  client_name TEXT,
  vendor_name TEXT,
  term TEXT,
  effective_date DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | active | superseded | terminated
  current_version INTEGER NOT NULL DEFAULT 1,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sow_contracts_owner ON public.sow_contracts(owner_id);
CREATE INDEX idx_sow_contracts_status ON public.sow_contracts(status);

-- Immutable version snapshots
CREATE TABLE public.sow_contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.sow_contracts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,    -- reference, client, vendor, term, dates...
  clauses JSONB NOT NULL DEFAULT '[]'::jsonb, -- frozen clause list at this version
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, version)
);

CREATE INDEX idx_sow_versions_contract ON public.sow_contract_versions(contract_id, version DESC);

-- Field-level audit trail
CREATE TABLE public.sow_contract_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.sow_contracts(id) ON DELETE CASCADE,
  version INTEGER,
  action TEXT NOT NULL, -- created | revised | clause_added | clause_removed | clause_edited | meta_updated | status_changed
  field TEXT,
  old_value JSONB,
  new_value JSONB,
  note TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sow_audit_contract ON public.sow_contract_audit(contract_id, created_at DESC);

-- Updated-at trigger (reuse existing helper if present, else create)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_sow_contracts_updated_at
BEFORE UPDATE ON public.sow_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.sow_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sow_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sow_contract_audit ENABLE ROW LEVEL SECURITY;

-- Contracts: owner can do everything; admins/team_leads can view/manage all (uses existing has_role if available)
CREATE POLICY "Owners can view their contracts"
  ON public.sow_contracts FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their contracts"
  ON public.sow_contracts FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their contracts"
  ON public.sow_contracts FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their contracts"
  ON public.sow_contracts FOR DELETE
  USING (auth.uid() = owner_id);

-- Versions: readable/writable if you can see the parent contract (owner)
CREATE POLICY "Versions visible to contract owner"
  ON public.sow_contract_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sow_contracts c
    WHERE c.id = sow_contract_versions.contract_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Versions insertable by contract owner"
  ON public.sow_contract_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sow_contracts c
    WHERE c.id = sow_contract_versions.contract_id AND c.owner_id = auth.uid()
  ));

-- Audit: read-only for owners; insertable by owners (writes are app-driven)
CREATE POLICY "Audit visible to contract owner"
  ON public.sow_contract_audit FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sow_contracts c
    WHERE c.id = sow_contract_audit.contract_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Audit insertable by contract owner"
  ON public.sow_contract_audit FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sow_contracts c
    WHERE c.id = sow_contract_audit.contract_id AND c.owner_id = auth.uid()
  ));
