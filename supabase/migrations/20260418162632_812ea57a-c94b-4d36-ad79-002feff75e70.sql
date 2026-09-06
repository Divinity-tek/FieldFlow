-- SmartMatch saved searches
CREATE TABLE public.smart_match_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_types TEXT[] DEFAULT '{}',
  required_skills TEXT[] DEFAULT '{}',
  region_ids UUID[] DEFAULT '{}',
  max_distance_km NUMERIC,
  min_pay NUMERIC,
  priorities TEXT[] DEFAULT '{}',
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_push BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.smart_match_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers manage own searches"
ON public.smart_match_searches
FOR ALL
USING (
  engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX idx_smart_match_searches_engineer ON public.smart_match_searches(engineer_id);
CREATE INDEX idx_smart_match_searches_active ON public.smart_match_searches(is_active) WHERE is_active = true;

CREATE TRIGGER trg_smart_match_searches_updated
BEFORE UPDATE ON public.smart_match_searches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alerts log (dedupes notifications per job per search)
CREATE TABLE public.smart_match_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES public.smart_match_searches(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  match_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (search_id, job_id)
);

ALTER TABLE public.smart_match_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers view own alerts"
ON public.smart_match_alerts
FOR SELECT
USING (
  engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX idx_smart_match_alerts_engineer ON public.smart_match_alerts(engineer_id, created_at DESC);

-- Evaluation function
CREATE OR REPLACE FUNCTION public.evaluate_smart_match_for_job(_job_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_search RECORD;
  v_eng RECORD;
  v_distance NUMERIC;
  v_score NUMERIC;
  v_skill_overlap INT;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND OR v_job.engineer_id IS NOT NULL THEN
    RETURN;
  END IF;

  FOR v_search IN
    SELECT s.* FROM public.smart_match_searches s
    WHERE s.is_active = true
  LOOP
    SELECT e.* INTO v_eng FROM public.engineers e WHERE e.id = v_search.engineer_id;
    IF NOT FOUND OR v_eng.is_available = false THEN
      CONTINUE;
    END IF;

    -- Service type filter
    IF array_length(v_search.service_types, 1) > 0
       AND NOT (v_job.service_type = ANY(v_search.service_types)) THEN
      CONTINUE;
    END IF;

    -- Region filter
    IF array_length(v_search.region_ids, 1) > 0
       AND (v_job.region_id IS NULL OR NOT (v_job.region_id = ANY(v_search.region_ids))) THEN
      CONTINUE;
    END IF;

    -- Priority filter
    IF array_length(v_search.priorities, 1) > 0
       AND NOT (v_job.priority::text = ANY(v_search.priorities)) THEN
      CONTINUE;
    END IF;

    -- Min pay filter
    IF v_search.min_pay IS NOT NULL
       AND COALESCE(v_job.engineer_charge, v_job.base_price, 0) < v_search.min_pay THEN
      CONTINUE;
    END IF;

    -- Required skills filter
    IF array_length(v_search.required_skills, 1) > 0 THEN
      SELECT cardinality(ARRAY(SELECT unnest(v_search.required_skills) INTERSECT SELECT unnest(v_eng.skills)))
        INTO v_skill_overlap;
      IF v_skill_overlap < array_length(v_search.required_skills, 1) THEN
        CONTINUE;
      END IF;
    END IF;

    -- Distance filter
    v_distance := NULL;
    IF v_search.max_distance_km IS NOT NULL
       AND v_eng.latitude IS NOT NULL AND v_eng.longitude IS NOT NULL
       AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      v_distance := public.haversine_meters(v_eng.latitude, v_eng.longitude, v_job.latitude, v_job.longitude) / 1000.0;
      IF v_distance > v_search.max_distance_km THEN
        CONTINUE;
      END IF;
    END IF;

    -- Score (simple: closer + better-paying = higher)
    v_score := 50
      + COALESCE((100 - LEAST(COALESCE(v_distance, 50), 100)), 0) * 0.3
      + LEAST(COALESCE(v_job.engineer_charge, v_job.base_price, 0) / 10.0, 50) * 0.4;

    -- Insert alert (skip duplicate)
    BEGIN
      INSERT INTO public.smart_match_alerts (search_id, engineer_id, job_id, match_score)
      VALUES (v_search.id, v_search.engineer_id, v_job.id, ROUND(v_score, 1));

      IF v_search.notify_push THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
          v_eng.user_id,
          'New SmartMatch: ' || v_search.name,
          format('%s in %s — matches your saved alert.', v_job.title, v_job.location),
          'smart_match',
          jsonb_build_object(
            'job_id', v_job.id,
            'search_id', v_search.id,
            'match_score', ROUND(v_score, 1),
            'distance_km', v_distance
          )
        );
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- already alerted, skip
      NULL;
    END;
  END LOOP;
END;
$$;

-- Trigger on jobs
CREATE OR REPLACE FUNCTION public.trg_jobs_smart_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.engineer_id IS NULL AND NEW.status IN ('pending', 'open') THEN
    PERFORM public.evaluate_smart_match_for_job(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_smart_match_insert
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.trg_jobs_smart_match();

CREATE TRIGGER trg_jobs_smart_match_update
AFTER UPDATE OF status, service_type, region_id, latitude, longitude, engineer_charge, base_price ON public.jobs
FOR EACH ROW
WHEN (NEW.engineer_id IS NULL)
EXECUTE FUNCTION public.trg_jobs_smart_match();