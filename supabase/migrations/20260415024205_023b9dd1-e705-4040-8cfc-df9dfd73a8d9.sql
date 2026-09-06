
INSERT INTO storage.buckets (id, name, public)
VALUES ('survey-photos', 'survey-photos', true);

CREATE POLICY "Anyone can view survey photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'survey-photos');

CREATE POLICY "Authenticated users can upload survey photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'survey-photos');

CREATE POLICY "Authenticated users can update own survey photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'survey-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete own survey photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'survey-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
