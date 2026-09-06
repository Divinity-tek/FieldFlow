-- 1) Restrict dispatch_agent_settings SELECT to admins only (lifecycle_secret was readable by team_leads)
DROP POLICY IF EXISTS "Staff can read settings" ON public.dispatch_agent_settings;
CREATE POLICY "Admins can read settings"
  ON public.dispatch_agent_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Add missing UPDATE storage policies for engineer-receipts and engineer-certifications,
--    scoped to the engineer's own folder.
CREATE POLICY "Engineers update own receipt files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'engineer-receipts'
    AND (storage.foldername(name))[1] = public.current_engineer_id()::text
  )
  WITH CHECK (
    bucket_id = 'engineer-receipts'
    AND (storage.foldername(name))[1] = public.current_engineer_id()::text
  );

CREATE POLICY "Engineers update own certification files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'engineer-certifications'
    AND (storage.foldername(name))[1] = public.current_engineer_id()::text
  )
  WITH CHECK (
    bucket_id = 'engineer-certifications'
    AND (storage.foldername(name))[1] = public.current_engineer_id()::text
  );

-- 3) Remove tables with sensitive financial columns from the Realtime publication
--    so engineers can no longer subscribe and observe broadcast row changes
--    containing platform_cut / partner_cut / engineer_net / split percentages.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.jobs';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'marketplace_listings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.marketplace_listings';
  END IF;
END $$;