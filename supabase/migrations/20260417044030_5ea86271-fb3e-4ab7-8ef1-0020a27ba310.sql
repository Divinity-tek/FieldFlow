-- Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('chat-attachments','survey-photos');

-- Replace public read policies with authenticated-only
DROP POLICY IF EXISTS "Chat attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view survey photos" ON storage.objects;

CREATE POLICY "Authenticated users can view chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated users can view survey photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'survey-photos');

-- Tighten uploads to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload survey photos" ON storage.objects;

CREATE POLICY "Users upload chat attachments to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users upload survey photos to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'survey-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);