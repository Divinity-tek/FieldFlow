
-- 1. Job columns
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS required_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_delayed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delayed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delayed_reason text,
  ADD COLUMN IF NOT EXISTS auto_reassign_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reassign_grace_minutes int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS reassign_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reassigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_engineer_ids uuid[] NOT NULL DEFAULT '{}';

-- 2. Audit table
CREATE TABLE IF NOT EXISTS public.job_reassignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  previous_engineer_id uuid REFERENCES public.engineers(id) ON DELETE SET NULL,
  new_engineer_id uuid REFERENCES public.engineers(id) ON DELETE SET NULL,
  match_score numeric,
  distance_km numeric,
  reason text,
  triggered_by uuid,
  triggered_kind text NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_reassignments_job_id_idx ON public.job_reassignments(job_id);

ALTER TABLE public.job_reassignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reassign audit visible to staff and engineers" ON public.job_reassignments;
CREATE POLICY "Reassign audit visible to staff and engineers"
ON public.job_reassignments FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_lead')
  OR EXISTS (
    SELECT 1 FROM public.engineers e
    WHERE (e.id = previous_engineer_id OR e.id = new_engineer_id)
      AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Reassign audit insert by service" ON public.job_reassignments;
CREATE POLICY "Reassign audit insert by service"
ON public.job_reassignments FOR INSERT
WITH CHECK (true); -- writes happen inside SECURITY DEFINER functions

-- 3. Selection helper
CREATE OR REPLACE FUNCTION public.find_best_engineer_for_job(_job_id uuid)
RETURNS TABLE(engineer_id uuid, score numeric, distance_km numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT e.*,
      CASE WHEN v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL
                AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
           THEN public.haversine_meters(e.latitude, e.longitude, v_job.latitude, v_job.longitude) / 1000.0
           ELSE NULL END AS dist_km,
      COALESCE(s.success_score, 50) AS success_score
    FROM public.engineers e
    LEFT JOIN public.engineer_success_scores s ON s.engineer_id = e.id
    WHERE COALESCE(e.is_available, true) = true
      AND e.id IS DISTINCT FROM v_job.engineer_id
      AND NOT (e.id = ANY(COALESCE(v_job.previous_engineer_ids, ARRAY[]::uuid[])))
      AND (
        COALESCE(array_length(v_job.required_skills, 1), 0) = 0
        OR (e.skills @> v_job.required_skills)
      )
      AND (v_job.region_id IS NULL OR e.region_id IS NULL OR e.region_id = v_job.region_id)
  )
  SELECT c.id,
    ROUND(
      ( -- Distance: closer is better, max 50 pts (0 km = 50, 100 km = 0)
        CASE WHEN c.dist_km IS NULL THEN 25
             ELSE GREATEST(0, 50 - LEAST(c.dist_km, 100) * 0.5) END
        + -- Success score: 0..30 pts
        (LEAST(GREATEST(c.success_score, 0), 100) * 0.30)
        + -- Rating: 0..20 pts
        (LEAST(GREATEST(COALESCE(c.rating, 0), 0), 5) * 4)
      )::numeric, 2
    ) AS score,
    ROUND(c.dist_km::numeric, 2) AS distance_km
  FROM candidates c
  ORDER BY score DESC NULLS LAST, c.dist_km ASC NULLS LAST
  LIMIT 5;
END;
$$;

-- 4. Reassign single job
CREATE OR REPLACE FUNCTION public.reassign_delayed_job(_job_id uuid, _kind text DEFAULT 'manual', _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_old_eng RECORD;
  v_new RECORD;
  v_new_eng RECORD;
  v_client_user uuid;
  v_actor uuid := auth.uid();
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
  END IF;

  -- Permission check for manual triggers (auto runs as service)
  IF _kind = 'manual' AND v_actor IS NOT NULL THEN
    IF NOT (
      public.has_role(v_actor, 'admin')
      OR public.has_role(v_actor, 'team_lead')
      OR public.has_role(v_actor, 'coordinator')
      OR v_job.created_by = v_actor
    ) THEN
      RAISE EXCEPTION 'Not authorized to reassign this job' USING ERRCODE='insufficient_privilege';
    END IF;
  END IF;

  IF v_job.status::text IN ('in_progress','completed','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not eligible (status=' || v_job.status::text || ')');
  END IF;

  IF NOT v_job.auto_reassign_enabled AND _kind = 'auto' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Auto reassignment disabled for this job');
  END IF;

  SELECT * INTO v_new FROM public.find_best_engineer_for_job(_job_id) LIMIT 1;
  IF v_new.engineer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No suitable engineer found');
  END IF;

  IF v_job.engineer_id IS NOT NULL THEN
    SELECT * INTO v_old_eng FROM public.engineers WHERE id = v_job.engineer_id;
  END IF;
  SELECT * INTO v_new_eng FROM public.engineers WHERE id = v_new.engineer_id;

  -- Update the job
  UPDATE public.jobs
     SET engineer_id = v_new.engineer_id,
         status = 'assigned',
         is_delayed = false,
         delayed_at = NULL,
         delayed_reason = NULL,
         reassign_count = reassign_count + 1,
         last_reassigned_at = now(),
         previous_engineer_ids = (
           CASE WHEN v_job.engineer_id IS NULL THEN previous_engineer_ids
                ELSE array_append(previous_engineer_ids, v_job.engineer_id) END
         ),
         assigned_by = COALESCE(v_actor, assigned_by),
         updated_at = now()
   WHERE id = _job_id;

  -- Audit
  INSERT INTO public.job_reassignments
    (job_id, previous_engineer_id, new_engineer_id, match_score, distance_km, reason, triggered_by, triggered_kind)
  VALUES
    (_job_id, v_job.engineer_id, v_new.engineer_id, v_new.score, v_new.distance_km,
     COALESCE(_reason, CASE WHEN _kind='auto' THEN 'Auto reassignment (delayed job)' ELSE 'Manual reassignment' END),
     v_actor, _kind);

  -- Notify new engineer
  IF v_new_eng.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      v_new_eng.user_id,
      'New job assigned',
      format('You have been assigned to "%s" at %s.', v_job.title, v_job.location),
      'job_reassigned',
      jsonb_build_object('job_id', v_job.id, 'role', 'new_engineer', 'kind', _kind, 'score', v_new.score)
    );
  END IF;

  -- Notify previous engineer
  IF v_old_eng.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      v_old_eng.user_id,
      'Job reassigned',
      format('"%s" has been reassigned to another engineer.', v_job.title),
      'job_reassigned',
      jsonb_build_object('job_id', v_job.id, 'role', 'previous_engineer', 'kind', _kind)
    );
  END IF;

  -- Notify client owner
  SELECT user_id INTO v_client_user FROM public.clients WHERE id = v_job.client_id;
  IF v_client_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      v_client_user,
      'Engineer reassigned for your job',
      format('A new engineer has been dispatched for "%s".', v_job.title),
      'job_reassigned',
      jsonb_build_object('job_id', v_job.id, 'role', 'client', 'kind', _kind)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', _job_id,
    'new_engineer_id', v_new.engineer_id,
    'previous_engineer_id', v_job.engineer_id,
    'score', v_new.score,
    'distance_km', v_new.distance_km
  );
END;
$$;

-- 5. Scheduled scan
CREATE OR REPLACE FUNCTION public.auto_reassign_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_processed int := 0;
  v_success int := 0;
  v_result jsonb;
BEGIN
  FOR v_job IN
    SELECT id FROM public.jobs
    WHERE auto_reassign_enabled = true
      AND status::text IN ('pending','assigned','accepted','on_the_way')
      AND started_at IS NULL
      AND (
        is_delayed = true
        OR (
          scheduled_at IS NOT NULL
          AND scheduled_at + (reassign_grace_minutes || ' minutes')::interval < now()
        )
      )
      AND (last_reassigned_at IS NULL OR last_reassigned_at < now() - interval '5 minutes')
    LIMIT 50
  LOOP
    v_processed := v_processed + 1;
    BEGIN
      v_result := public.reassign_delayed_job(v_job.id, 'auto', NULL);
      IF (v_result->>'ok')::boolean THEN
        v_success := v_success + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- swallow per-job errors so the scan keeps going
      CONTINUE;
    END;
  END LOOP;
  RETURN jsonb_build_object('processed', v_processed, 'reassigned', v_success);
END;
$$;
