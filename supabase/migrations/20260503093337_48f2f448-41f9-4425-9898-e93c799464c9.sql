-- Add per-version workflow status to SOW contract versions
ALTER TABLE public.sow_contract_versions
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- valid statuses: draft, in_review, approved, active, rejected, superseded
ALTER TABLE public.sow_contract_versions
  DROP CONSTRAINT IF EXISTS sow_version_workflow_status_check;
ALTER TABLE public.sow_contract_versions
  ADD CONSTRAINT sow_version_workflow_status_check
  CHECK (workflow_status IN ('draft','in_review','approved','active','rejected','superseded'));

-- Allow team_leads and admins to view all contracts/versions/audit for the workflow
DROP POLICY IF EXISTS "Reviewers can view contracts" ON public.sow_contracts;
CREATE POLICY "Reviewers can view contracts"
  ON public.sow_contracts FOR SELECT
  USING (public.has_role(auth.uid(), 'team_lead') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Reviewers can update contract status" ON public.sow_contracts;
CREATE POLICY "Reviewers can update contract status"
  ON public.sow_contracts FOR UPDATE
  USING (public.has_role(auth.uid(), 'team_lead') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Reviewers can view versions" ON public.sow_contract_versions;
CREATE POLICY "Reviewers can view versions"
  ON public.sow_contract_versions FOR SELECT
  USING (public.has_role(auth.uid(), 'team_lead') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Reviewers can update versions" ON public.sow_contract_versions;
CREATE POLICY "Reviewers can update versions"
  ON public.sow_contract_versions FOR UPDATE
  USING (public.has_role(auth.uid(), 'team_lead') OR public.has_role(auth.uid(), 'admin'));

-- Owners can update their own version (e.g. to submit for review while still draft)
DROP POLICY IF EXISTS "Owners can update their versions" ON public.sow_contract_versions;
CREATE POLICY "Owners can update their versions"
  ON public.sow_contract_versions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.sow_contracts c
                  WHERE c.id = sow_contract_versions.contract_id AND c.owner_id = auth.uid()));

-- Audit trail visibility for reviewers
DROP POLICY IF EXISTS "Reviewers can view audit" ON public.sow_contract_audit;
CREATE POLICY "Reviewers can view audit"
  ON public.sow_contract_audit FOR SELECT
  USING (public.has_role(auth.uid(), 'team_lead') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Reviewers can insert audit" ON public.sow_contract_audit;
CREATE POLICY "Reviewers can insert audit"
  ON public.sow_contract_audit FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'team_lead') OR public.has_role(auth.uid(), 'admin')
              OR EXISTS (SELECT 1 FROM public.sow_contracts c
                          WHERE c.id = sow_contract_audit.contract_id AND c.owner_id = auth.uid()));

-- ====== Workflow RPC ======
CREATE OR REPLACE FUNCTION public.sow_version_transition(
  _contract_id uuid,
  _version int,
  _to_status text,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  c RECORD;
  uid uuid := auth.uid();
  is_admin boolean := public.has_role(uid, 'admin');
  is_lead boolean := public.has_role(uid, 'team_lead');
  is_owner boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v FROM public.sow_contract_versions
   WHERE contract_id = _contract_id AND version = _version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;

  SELECT * INTO c FROM public.sow_contracts WHERE id = _contract_id;
  is_owner := (c.owner_id = uid);

  IF NOT (is_owner OR is_lead OR is_admin) THEN
    RAISE EXCEPTION 'Not authorized for this contract';
  END IF;

  -- Validate transitions + permissions
  IF _to_status = 'in_review' THEN
    IF v.workflow_status NOT IN ('draft','rejected') THEN
      RAISE EXCEPTION 'Can only submit a draft or rejected version for review';
    END IF;
    IF NOT (is_owner OR is_lead OR is_admin) THEN
      RAISE EXCEPTION 'Only the contract owner can submit for review';
    END IF;
    UPDATE public.sow_contract_versions
       SET workflow_status='in_review', submitted_at=now(), submitted_by=uid, rejection_reason=NULL
     WHERE id = v.id;

  ELSIF _to_status = 'approved' THEN
    IF v.workflow_status <> 'in_review' THEN
      RAISE EXCEPTION 'Only versions in review can be approved';
    END IF;
    IF NOT (is_lead OR is_admin) THEN
      RAISE EXCEPTION 'Only team leads or admins can approve';
    END IF;
    UPDATE public.sow_contract_versions
       SET workflow_status='approved', approved_at=now(), approved_by=uid,
           reviewed_at=COALESCE(reviewed_at, now()), reviewed_by=COALESCE(reviewed_by, uid)
     WHERE id = v.id;

  ELSIF _to_status = 'active' THEN
    IF v.workflow_status <> 'approved' THEN
      RAISE EXCEPTION 'Only approved versions can be activated';
    END IF;
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Only admins can activate a contract version';
    END IF;
    -- Supersede any other active version for this contract
    UPDATE public.sow_contract_versions
       SET workflow_status='superseded'
     WHERE contract_id = _contract_id AND workflow_status='active' AND id <> v.id;
    UPDATE public.sow_contract_versions
       SET workflow_status='active', activated_at=now(), activated_by=uid
     WHERE id = v.id;
    UPDATE public.sow_contracts
       SET status='active', updated_at=now()
     WHERE id = _contract_id;

  ELSIF _to_status = 'rejected' THEN
    IF v.workflow_status <> 'in_review' THEN
      RAISE EXCEPTION 'Only versions in review can be rejected';
    END IF;
    IF NOT (is_lead OR is_admin) THEN
      RAISE EXCEPTION 'Only team leads or admins can reject';
    END IF;
    UPDATE public.sow_contract_versions
       SET workflow_status='rejected', reviewed_at=now(), reviewed_by=uid, rejection_reason=_note
     WHERE id = v.id;

  ELSIF _to_status = 'draft' THEN
    -- Withdraw a submission
    IF v.workflow_status NOT IN ('in_review','rejected') THEN
      RAISE EXCEPTION 'Cannot return this version to draft';
    END IF;
    IF NOT (is_owner OR is_admin) THEN
      RAISE EXCEPTION 'Only the contract owner can withdraw';
    END IF;
    UPDATE public.sow_contract_versions
       SET workflow_status='draft'
     WHERE id = v.id;

  ELSE
    RAISE EXCEPTION 'Unknown target status: %', _to_status;
  END IF;

  INSERT INTO public.sow_contract_audit
    (contract_id, version, action, field, old_value, new_value, note, actor_id)
  VALUES (
    _contract_id, _version, 'workflow_transition', 'workflow_status',
    to_jsonb(v.workflow_status), to_jsonb(_to_status), _note, uid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sow_version_transition(uuid, int, text, text) TO authenticated;