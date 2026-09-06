-- 1) Lock down the RPC to authenticated users only
REVOKE EXECUTE ON FUNCTION public.sow_version_transition(uuid, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sow_version_transition(uuid, int, text, text) TO authenticated;

-- 2) Prevent direct writes to workflow fields outside the transition RPC.
--    The RPC sets a per-transaction GUC; the trigger only allows workflow-field
--    changes when that GUC is present.
CREATE OR REPLACE FUNCTION public.sow_block_direct_workflow_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text;
BEGIN
  v_allowed := current_setting('app.sow_workflow_rpc', true);
  IF v_allowed = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.workflow_status IS DISTINCT FROM OLD.workflow_status
     OR NEW.submitted_at  IS DISTINCT FROM OLD.submitted_at
     OR NEW.submitted_by  IS DISTINCT FROM OLD.submitted_by
     OR NEW.reviewed_at   IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by   IS DISTINCT FROM OLD.reviewed_by
     OR NEW.approved_at   IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by   IS DISTINCT FROM OLD.approved_by
     OR NEW.activated_at  IS DISTINCT FROM OLD.activated_at
     OR NEW.activated_by  IS DISTINCT FROM OLD.activated_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
  THEN
    RAISE EXCEPTION 'Workflow fields can only be changed via sow_version_transition()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sow_block_direct_workflow_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sow_block_direct_workflow_writes ON public.sow_contract_versions;
CREATE TRIGGER trg_sow_block_direct_workflow_writes
  BEFORE UPDATE ON public.sow_contract_versions
  FOR EACH ROW EXECUTE FUNCTION public.sow_block_direct_workflow_writes();

-- 3) Update the RPC to flag the GUC so the trigger lets it through
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
  is_lead  boolean := public.has_role(uid, 'team_lead');
  is_owner boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege'; END IF;

  -- Allow this transaction to update workflow fields
  PERFORM set_config('app.sow_workflow_rpc', 'on', true);

  SELECT * INTO v FROM public.sow_contract_versions
   WHERE contract_id = _contract_id AND version = _version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;

  SELECT * INTO c FROM public.sow_contracts WHERE id = _contract_id;
  is_owner := (c.owner_id = uid);

  IF NOT (is_owner OR is_lead OR is_admin) THEN
    RAISE EXCEPTION 'Not authorized for this contract' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF _to_status = 'in_review' THEN
    IF v.workflow_status NOT IN ('draft','rejected') THEN
      RAISE EXCEPTION 'Can only submit a draft or rejected version for review';
    END IF;
    IF NOT (is_owner OR is_lead OR is_admin) THEN
      RAISE EXCEPTION 'Only the contract owner can submit for review' USING ERRCODE = 'insufficient_privilege';
    END IF;
    UPDATE public.sow_contract_versions
       SET workflow_status='in_review', submitted_at=now(), submitted_by=uid, rejection_reason=NULL
     WHERE id = v.id;

  ELSIF _to_status = 'approved' THEN
    IF v.workflow_status <> 'in_review' THEN
      RAISE EXCEPTION 'Only versions in review can be approved';
    END IF;
    IF NOT (is_lead OR is_admin) THEN
      RAISE EXCEPTION 'Only team leads or admins can approve' USING ERRCODE = 'insufficient_privilege';
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
      RAISE EXCEPTION 'Only admins can activate a contract version' USING ERRCODE = 'insufficient_privilege';
    END IF;
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
      RAISE EXCEPTION 'Only team leads or admins can reject' USING ERRCODE = 'insufficient_privilege';
    END IF;
    UPDATE public.sow_contract_versions
       SET workflow_status='rejected', reviewed_at=now(), reviewed_by=uid, rejection_reason=_note
     WHERE id = v.id;

  ELSIF _to_status = 'draft' THEN
    IF v.workflow_status NOT IN ('in_review','rejected') THEN
      RAISE EXCEPTION 'Cannot return this version to draft';
    END IF;
    IF NOT (is_owner OR is_admin) THEN
      RAISE EXCEPTION 'Only the contract owner can withdraw' USING ERRCODE = 'insufficient_privilege';
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

  PERFORM set_config('app.sow_workflow_rpc', 'off', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sow_version_transition(uuid, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sow_version_transition(uuid, int, text, text) TO authenticated;