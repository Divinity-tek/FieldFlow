
-- chat-attachments: restrict SELECT to owner-folder or staff
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone authenticated can view chat attachments" ON storage.objects;

CREATE POLICY "Owner or staff can read chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
  )
);

-- survey-photos: restrict SELECT to owner-folder or staff
DROP POLICY IF EXISTS "Authenticated can view survey photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view survey photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view survey photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read survey photos" ON storage.objects;

CREATE POLICY "Owner or staff can read survey photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'survey-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
  )
);

-- webhook_deliveries: drop public INSERT policy; only service role writes
DROP POLICY IF EXISTS "Service inserts deliveries" ON public.webhook_deliveries;
