-- Add visibility + versioning to notes templates
ALTER TABLE public.estimate_notes_templates
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

-- Constrain visibility values
DO $$ BEGIN
  ALTER TABLE public.estimate_notes_templates
    ADD CONSTRAINT estimate_notes_templates_visibility_check
    CHECK (visibility IN ('all','admin_only','team_lead_allowed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Version history table
CREATE TABLE IF NOT EXISTS public.estimate_notes_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.estimate_notes_templates(id) ON DELETE CASCADE,
  version int NOT NULL,
  label text NOT NULL,
  content text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'all',
  changed_by uuid,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ent_versions_template ON public.estimate_notes_template_versions(template_id, version DESC);

ALTER TABLE public.estimate_notes_template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View template versions" ON public.estimate_notes_template_versions;
CREATE POLICY "View template versions" ON public.estimate_notes_template_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

DROP POLICY IF EXISTS "Insert template versions" ON public.estimate_notes_template_versions;
CREATE POLICY "Insert template versions" ON public.estimate_notes_template_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'));

-- Trigger: snapshot to versions on update; bump version
CREATE OR REPLACE FUNCTION public.snapshot_notes_template_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.label IS DISTINCT FROM OLD.label
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
      INSERT INTO public.estimate_notes_template_versions
        (template_id, version, label, content, sort_order, is_active, visibility, changed_by)
      VALUES
        (OLD.id, OLD.version, OLD.label, OLD.content, OLD.sort_order, OLD.is_active, COALESCE(OLD.visibility,'all'), auth.uid());
      NEW.version := OLD.version + 1;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.estimate_notes_template_versions
      (template_id, version, label, content, sort_order, is_active, visibility, changed_by)
    VALUES
      (NEW.id, NEW.version, NEW.label, NEW.content, NEW.sort_order, NEW.is_active, COALESCE(NEW.visibility,'all'), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_notes_template ON public.estimate_notes_templates;
CREATE TRIGGER trg_snapshot_notes_template
  BEFORE UPDATE ON public.estimate_notes_templates
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_notes_template_version();

DROP TRIGGER IF EXISTS trg_snapshot_notes_template_ins ON public.estimate_notes_templates;
CREATE TRIGGER trg_snapshot_notes_template_ins
  AFTER INSERT ON public.estimate_notes_templates
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_notes_template_version();

-- Update SELECT policy to enforce visibility
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.estimate_notes_templates;
DROP POLICY IF EXISTS "View notes templates with visibility" ON public.estimate_notes_templates;
CREATE POLICY "View notes templates with visibility" ON public.estimate_notes_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      visibility = 'all'
      OR (visibility = 'team_lead_allowed' AND public.has_role(auth.uid(), 'team_lead'))
    )
  );
