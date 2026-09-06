
ALTER TABLE public.site_surveys
ADD COLUMN photo_annotations jsonb NOT NULL DEFAULT '{}'::jsonb;
