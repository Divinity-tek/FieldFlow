
-- ============================================================
-- Secure engineer-facing views for jobs and marketplace_listings
-- Purpose: ensure engineer-side queries can NEVER read sensitive
--   financial fields (margins, splits, partner/platform cuts, etc.)
-- ============================================================

-- ---------- jobs_engineer_safe ----------
-- Definer view: bypasses base-table RLS so we can drop engineer
-- direct SELECT on public.jobs. Access predicate enforced inline.
CREATE OR REPLACE VIEW public.jobs_engineer_safe
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  j.id, j.title, j.description, j.status, j.priority, j.service_type,
  j.client_id, j.engineer_id, j.assigned_by,
  j.location, j.latitude, j.longitude,
  j.scheduled_at, j.started_at, j.completed_at,
  j.notes, j.created_at, j.updated_at,
  j.region_id, j.geofence_radius, j.required_skills,
  j.is_delayed, j.delayed_at, j.delayed_reason,
  j.auto_reassign_enabled, j.reassign_grace_minutes,
  j.reassign_count, j.last_reassigned_at,
  -- Allowances and engineer-net pay are visible to the assigned engineer
  j.transport_allowance, j.food_allowance, j.convenience_allowance,
  j.engineer_net,
  j.payout_status, j.payout_approved_at, j.payout_paid_at, j.payout_paid_amount
FROM public.jobs j
WHERE
  -- Engineer is assigned to the job
  j.engineer_id IN (SELECT e.id FROM public.engineers e WHERE e.user_id = auth.uid())
  OR
  -- Engineer applied to the job via marketplace (so they can track it)
  EXISTS (
    SELECT 1 FROM public.marketplace_applications ma
    JOIN public.engineers e ON e.id = ma.engineer_id
    WHERE ma.job_id = j.id AND e.user_id = auth.uid()
  );

ALTER VIEW public.jobs_engineer_safe OWNER TO postgres;
REVOKE ALL ON public.jobs_engineer_safe FROM PUBLIC;
GRANT SELECT ON public.jobs_engineer_safe TO authenticated;

-- ---------- marketplace_listings_engineer_safe ----------
CREATE OR REPLACE VIEW public.marketplace_listings_engineer_safe
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  l.id, l.job_id, l.posted_by, l.visibility,
  l.posted_pay, l.pay_negotiable,
  l.required_certifications, l.required_skills,
  l.expires_at, l.status, l.view_count,
  l.created_at, l.updated_at,
  -- Engineer-facing pay components only
  l.transport_allowance, l.food_allowance, l.convenience_allowance,
  l.engineer_net, l.payout_status
FROM public.marketplace_listings l
WHERE
  l.status = 'open'
  OR EXISTS (
    SELECT 1 FROM public.marketplace_applications ma
    JOIN public.engineers e ON e.id = ma.engineer_id
    WHERE ma.listing_id = l.id AND e.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.engineers e ON e.id = j.engineer_id
    WHERE j.id = l.job_id AND e.user_id = auth.uid()
  );

ALTER VIEW public.marketplace_listings_engineer_safe OWNER TO postgres;
REVOKE ALL ON public.marketplace_listings_engineer_safe FROM PUBLIC;
GRANT SELECT ON public.marketplace_listings_engineer_safe TO authenticated;

-- ---------- Drop direct engineer SELECT on base tables ----------
-- Engineers must read via the safe views going forward.
DROP POLICY IF EXISTS "Engineers can view assigned jobs" ON public.jobs;

-- View open listings (engineer-targeted) on marketplace_listings: replace
-- with a non-engineer policy (admins/team-leads keep full access via their
-- existing "Admins manage listings" policy).
DROP POLICY IF EXISTS "View open listings" ON public.marketplace_listings;

-- Engineers retain UPDATE on jobs (their existing policy is unchanged) so
-- status transitions still work; .update() does not require SELECT.
