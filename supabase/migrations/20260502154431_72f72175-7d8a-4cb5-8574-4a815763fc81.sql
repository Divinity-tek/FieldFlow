
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Partner logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

CREATE POLICY "Authenticated users can upload partner logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'partner-logos');

CREATE POLICY "Authenticated users can update partner logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'partner-logos');

CREATE POLICY "Authenticated users can delete partner logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'partner-logos');
