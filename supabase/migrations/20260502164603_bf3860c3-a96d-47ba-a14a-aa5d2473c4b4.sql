
-- Multi-step approval flow
CREATE TABLE IF NOT EXISTS public.estimate_approval_rule_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.estimate_approval_rules(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  name TEXT,
  required_role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_id, step_order)
);

ALTER TABLE public.estimate_approval_rule_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rule steps"
ON public.estimate_approval_rule_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/team_leads manage rule steps"
ON public.estimate_approval_rule_steps FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

ALTER TABLE public.estimate_approvals
  ADD COLUMN IF NOT EXISTS step_order INT,
  ADD COLUMN IF NOT EXISTS step_name TEXT,
  ADD COLUMN IF NOT EXISTS total_steps INT;

-- Replace evaluate function to support steps
CREATE OR REPLACE FUNCTION public.evaluate_estimate_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD;
  v_has_partner boolean;
  v_first_step RECORD;
  v_step_count int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.total = OLD.total
       AND NEW.client_id = OLD.client_id
       AND COALESCE(NEW.partner_id::text, '') = COALESCE(OLD.partner_id::text, '')
       AND NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;
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
    SELECT COUNT(*) INTO v_step_count
      FROM public.estimate_approval_rule_steps WHERE rule_id = v_rule.id;

    IF v_step_count > 0 THEN
      SELECT * INTO v_first_step
        FROM public.estimate_approval_rule_steps
       WHERE rule_id = v_rule.id
       ORDER BY step_order ASC LIMIT 1;

      IF NOT EXISTS (
        SELECT 1 FROM public.estimate_approvals
        WHERE estimate_id = NEW.id AND rule_id = v_rule.id
      ) THEN
        INSERT INTO public.estimate_approvals
          (estimate_id, rule_id, required_role, step_order, step_name, total_steps)
        VALUES
          (NEW.id, v_rule.id, v_first_step.required_role, v_first_step.step_order, v_first_step.name, v_step_count);
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.estimate_approvals
        WHERE estimate_id = NEW.id AND rule_id = v_rule.id AND status = 'pending'
      ) THEN
        INSERT INTO public.estimate_approvals (estimate_id, rule_id, required_role, total_steps)
        VALUES (NEW.id, v_rule.id, v_rule.required_role, 1);
      END IF;
    END IF;

    IF NEW.status = 'draft' THEN
      NEW.status := 'pending_approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Replace decision trigger to advance steps
CREATE OR REPLACE FUNCTION public.apply_estimate_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending int;
  v_rejected int;
  v_next RECORD;
  v_total_steps int;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('approved','rejected') AND NEW.decided_at IS NULL THEN
    NEW.decided_at := now();
    NEW.approver_id := COALESCE(NEW.approver_id, auth.uid());
  END IF;

  IF NEW.status = 'rejected' THEN
    UPDATE public.estimates SET status = 'rejected', updated_at = now()
     WHERE id = NEW.estimate_id;
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND NEW.rule_id IS NOT NULL AND NEW.step_order IS NOT NULL THEN
    -- Look for next step in the rule
    SELECT * INTO v_next
      FROM public.estimate_approval_rule_steps
     WHERE rule_id = NEW.rule_id
       AND step_order > NEW.step_order
     ORDER BY step_order ASC LIMIT 1;

    SELECT COUNT(*) INTO v_total_steps
      FROM public.estimate_approval_rule_steps WHERE rule_id = NEW.rule_id;

    IF v_next.id IS NOT NULL THEN
      INSERT INTO public.estimate_approvals
        (estimate_id, rule_id, required_role, step_order, step_name, total_steps)
      VALUES
        (NEW.estimate_id, NEW.rule_id, v_next.required_role, v_next.step_order, v_next.name, v_total_steps);
      RETURN NEW;
    END IF;
  END IF;

  -- No next step. Final-decision logic mirrors the old behavior.
  SELECT COUNT(*) FILTER (WHERE status = 'pending'),
         COUNT(*) FILTER (WHERE status = 'rejected')
    INTO v_pending, v_rejected
    FROM public.estimate_approvals
   WHERE estimate_id = NEW.estimate_id
     AND id <> NEW.id;

  IF v_rejected > 0 THEN
    UPDATE public.estimates SET status = 'rejected', updated_at = now()
     WHERE id = NEW.estimate_id;
  ELSIF v_pending = 0 AND NEW.status = 'approved' THEN
    UPDATE public.estimates SET status = 'draft', updated_at = now()
     WHERE id = NEW.estimate_id AND status = 'pending_approval';
  END IF;

  RETURN NEW;
END;
$function$;
