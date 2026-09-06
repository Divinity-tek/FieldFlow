
ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS insurance_document_url text;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('engineer-documents', 'engineer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Avatars: public read, owner write/update/delete (folder = user_id)
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars owner upload" ON storage.objects;
CREATE POLICY "Avatars owner upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatars owner update" ON storage.objects;
CREATE POLICY "Avatars owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatars owner delete" ON storage.objects;
CREATE POLICY "Avatars owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Engineer documents: owner read/write, admins read all
DROP POLICY IF EXISTS "Eng docs owner read" ON storage.objects;
CREATE POLICY "Eng docs owner read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'engineer-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'team_lead')
    )
  );

DROP POLICY IF EXISTS "Eng docs owner upload" ON storage.objects;
CREATE POLICY "Eng docs owner upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'engineer-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Eng docs owner update" ON storage.objects;
CREATE POLICY "Eng docs owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'engineer-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Eng docs owner delete" ON storage.objects;
CREATE POLICY "Eng docs owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'engineer-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
