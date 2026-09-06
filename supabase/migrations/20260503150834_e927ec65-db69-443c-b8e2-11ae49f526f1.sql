-- 1. created_by column
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs(created_by);

CREATE OR REPLACE FUNCTION public.set_jobs_created_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_jobs_set_created_by ON public.jobs;
CREATE TRIGGER trg_jobs_set_created_by
BEFORE INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.set_jobs_created_by();

-- 2. Allow original poster to update/delete their jobs
DROP POLICY IF EXISTS "Posters can update own jobs" ON public.jobs;
CREATE POLICY "Posters can update own jobs" ON public.jobs
FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Posters can delete own jobs" ON public.jobs;
CREATE POLICY "Posters can delete own jobs" ON public.jobs
FOR DELETE USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));

-- 3. Activity log
CREATE TABLE IF NOT EXISTS public.job_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_activity_job ON public.job_activity_log(job_id, created_at DESC);
ALTER TABLE public.job_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job activity viewable by job stakeholders" ON public.job_activity_log;
CREATE POLICY "Job activity viewable by job stakeholders" ON public.job_activity_log
FOR SELECT USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead') OR has_role(auth.uid(),'associate_coordinator')
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (
       j.created_by = auth.uid()
    OR j.engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
    OR is_client_member(j.client_id, auth.uid())
  ))
);

CREATE OR REPLACE FUNCTION public.log_job_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action) VALUES (NEW.id, v_actor, 'created');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'updated','status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'updated','priority', OLD.priority::text, NEW.priority::text);
  END IF;
  IF NEW.engineer_id IS DISTINCT FROM OLD.engineer_id THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'updated','engineer_id', OLD.engineer_id::text, NEW.engineer_id::text);
  END IF;
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'updated','scheduled_at', OLD.scheduled_at::text, NEW.scheduled_at::text);
  END IF;
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'updated','total_price', OLD.total_price::text, NEW.total_price::text);
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'updated','title', OLD.title, NEW.title);
  END IF;
  IF NEW.location IS DISTINCT FROM OLD.location THEN
    INSERT INTO public.job_activity_log(job_id, actor_id, action, field, old_value, new_value)
    VALUES (NEW.id, v_actor, 'updated','location', OLD.location, NEW.location);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_job_changes ON public.jobs;
CREATE TRIGGER trg_log_job_changes
AFTER INSERT OR UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.log_job_changes();

-- 4. Notes
CREATE TABLE IF NOT EXISTS public.job_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_notes_job ON public.job_notes(job_id, created_at DESC);
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and stakeholders can view job notes" ON public.job_notes;
CREATE POLICY "Staff and stakeholders can view job notes" ON public.job_notes
FOR SELECT USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead') OR has_role(auth.uid(),'associate_coordinator')
  OR author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Authors can insert job notes" ON public.job_notes;
CREATE POLICY "Authors can insert job notes" ON public.job_notes
FOR INSERT WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors can update own notes" ON public.job_notes;
CREATE POLICY "Authors can update own notes" ON public.job_notes
FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors or admins can delete notes" ON public.job_notes;
CREATE POLICY "Authors or admins can delete notes" ON public.job_notes
FOR DELETE USING (author_id = auth.uid() OR has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_job_notes_updated ON public.job_notes;
CREATE TRIGGER trg_job_notes_updated BEFORE UPDATE ON public.job_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Attachments
CREATE TABLE IF NOT EXISTS public.job_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_attachments_job ON public.job_attachments(job_id, created_at DESC);
ALTER TABLE public.job_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job stakeholders can view attachments" ON public.job_attachments;
CREATE POLICY "Job stakeholders can view attachments" ON public.job_attachments
FOR SELECT USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead') OR has_role(auth.uid(),'associate_coordinator')
  OR uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (
       j.created_by = auth.uid()
    OR j.engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
    OR is_client_member(j.client_id, auth.uid())
  ))
);
DROP POLICY IF EXISTS "Uploaders can insert attachments" ON public.job_attachments;
CREATE POLICY "Uploaders can insert attachments" ON public.job_attachments
FOR INSERT WITH CHECK (uploaded_by = auth.uid());
DROP POLICY IF EXISTS "Uploaders or admins can delete attachments" ON public.job_attachments;
CREATE POLICY "Uploaders or admins can delete attachments" ON public.job_attachments
FOR DELETE USING (uploaded_by = auth.uid() OR has_role(auth.uid(),'admin'));

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('job-attachments','job-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Job attachments read" ON storage.objects;
CREATE POLICY "Job attachments read" ON storage.objects FOR SELECT
USING (bucket_id = 'job-attachments' AND (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'team_lead') OR has_role(auth.uid(),'associate_coordinator')
  OR EXISTS (
    SELECT 1 FROM public.job_attachments a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.file_path = name AND (
      a.uploaded_by = auth.uid()
      OR j.created_by = auth.uid()
      OR j.engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
      OR is_client_member(j.client_id, auth.uid())
    )
  )
));

DROP POLICY IF EXISTS "Job attachments insert" ON storage.objects;
CREATE POLICY "Job attachments insert" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Job attachments delete" ON storage.objects;
CREATE POLICY "Job attachments delete" ON storage.objects FOR DELETE
USING (bucket_id = 'job-attachments' AND (
  has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.job_attachments a WHERE a.file_path = name AND a.uploaded_by = auth.uid())
));