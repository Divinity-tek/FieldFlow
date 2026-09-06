-- Add new status value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending_approval'
      AND enumtypid = 'public.estimate_status'::regtype
  ) THEN
    ALTER TYPE public.estimate_status ADD VALUE 'pending_approval';
  END IF;
END$$;

-- Approval rules (thresholds)
CREATE TABLE IF NOT EXISTS public.estimate_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'any' CHECK (scope IN ('any','customer','partner')),
  min_total numeric NOT NULL DEFAULT 0,
  max_total numeric,
  currency text,
  required_role public.app_role NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage approval rules"
  ON public.estimate_approval_rules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads manage approval rules"
  ON public.estimate_approval_rules FOR ALL
  USING (public.has_role(auth.uid(), 'team_lead'))
  WITH CHECK (public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Authenticated users can view active rules"
  ON public.estimate_approval_rules FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER trg_appr_rules_updated
  BEFORE UPDATE ON public.estimate_approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approvals (per-estimate decisions)
CREATE TABLE IF NOT EXISTS public.estimate_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.estimate_approval_rules(id) ON DELETE SET NULL,
  required_role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approver_id uuid,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_approvals_estimate ON public.estimate_approvals(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_approvals_status ON public.estimate_approvals(status);

ALTER TABLE public.estimate_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage approvals"
  ON public.estimate_approvals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leads manage approvals"
  ON public.estimate_approvals FOR ALL
  USING (public.has_role(auth.uid(), 'team_lead'))
  WITH CHECK (public.has_role(auth.uid(), 'team_lead'));

CREATE POLICY "Required approvers can view their approvals"
  ON public.estimate_approvals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), required_role));

CREATE POLICY "Required approvers can decide their approvals"
  ON public.estimate_approvals FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), required_role))
  WITH CHECK (public.has_role(auth.uid(), required_role));

CREATE TRIGGER trg_appr_updated
  BEFORE UPDATE ON public.estimate_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: evaluate approval when estimate is created/updated
CREATE OR REPLACE FUNCTION public.evaluate_estimate_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_has_partner boolean;
BEGIN
  -- Only evaluate on insert, or when total/discount/tax/status changes meaningfully
  IF TG_OP = 'UPDATE' THEN
    IF NEW.total = OLD.total
       AND NEW.client_id = OLD.client_id
       AND COALESCE(NEW.partner_id::text, '') = COALESCE(OLD.partner_id::text, '')
       AND NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;
    -- Don't re-evaluate after a final decision
    IF NEW.status IN ('approved','rejected','expired') THEN
      RETURN NEW;
    END IF;
  END IF;

  v_has_partner := NEW.partner_id IS NOT NULL;

  SELECT * INTO v_rule
  FROM public.estimate_approval_rules r
  WHERE r.is_active = true
    AND (r.currency IS NULL OR r.currency = NEW.currency)
    AND (
      r.scope = 'any'
      OR (r.scope = 'partner' AND v_has_partner)
      OR (r.scope = 'customer' AND NOT v_has_partner)
    )
    AND NEW.total >= r.min_total
    AND (r.max_total IS NULL OR NEW.total <= r.max_total)
  ORDER BY r.priority DESC, r.min_total DESC
  LIMIT 1;

  IF v_rule.id IS NOT NULL THEN
    -- Create a pending approval if none exists yet for this estimate+rule
    IF NOT EXISTS (
      SELECT 1 FROM public.estimate_approvals
      WHERE estimate_id = NEW.id AND rule_id = v_rule.id AND status = 'pending'
    ) THEN
      INSERT INTO public.estimate_approvals (estimate_id, rule_id, required_role)
      VALUES (NEW.id, v_rule.id, v_rule.required_role);
    END IF;

    IF NEW.status = 'draft' THEN
      NEW.status := 'pending_approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estimate_evaluate_approval ON public.estimates;
CREATE TRIGGER trg_estimate_evaluate_approval
  BEFORE INSERT OR UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_estimate_approval();

-- Trigger on estimate_approvals: when all approvals approved -> set estimate back to draft (so it can be sent); rejected -> rejected
CREATE OR REPLACE FUNCTION public.apply_estimate_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
  v_rejected int;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('approved','rejected') AND NEW.decided_at IS NULL THEN
    NEW.decided_at := now();
    NEW.approver_id := COALESCE(NEW.approver_id, auth.uid());
  END IF;

  SELECT COUNT(*) FILTER (WHERE status = 'pending'),
         COUNT(*) FILTER (WHERE status = 'rejected')
    INTO v_pending, v_rejected
    FROM public.estimate_approvals
   WHERE estimate_id = NEW.estimate_id
     AND id <> NEW.id;

  -- include current row's new state
  IF NEW.status = 'rejected' THEN v_rejected := v_rejected + 1; END IF;

  IF v_rejected > 0 THEN
    UPDATE public.estimates SET status = 'rejected', updated_at = now()
     WHERE id = NEW.estimate_id;
  ELSIF v_pending = 0 AND NEW.status = 'approved' THEN
    -- All approved -> move to draft so the user can send it
    UPDATE public.estimates SET status = 'draft', updated_at = now()
     WHERE id = NEW.estimate_id AND status = 'pending_approval';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_approval_decision ON public.estimate_approvals;
CREATE TRIGGER trg_apply_approval_decision
  BEFORE UPDATE ON public.estimate_approvals
  FOR EACH ROW EXECUTE FUNCTION public.apply_estimate_approval_decision();