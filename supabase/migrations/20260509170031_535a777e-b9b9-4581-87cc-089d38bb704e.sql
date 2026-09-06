-- Replace the broad read policy with two narrower ones
DROP POLICY IF EXISTS "Eng docs owner read" ON storage.objects;

-- Identity files (selfie / ID card): owner + admin only
CREATE POLICY "Eng docs identity read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'engineer-documents'
  AND (
    position('/identity_selfie_url-' in name) > 0
    OR position('/id_card_url-' in name) > 0
  )
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- All other engineer documents: owner + admin + team_lead
CREATE POLICY "Eng docs general read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'engineer-documents'
  AND position('/identity_selfie_url-' in name) = 0
  AND position('/id_card_url-' in name) = 0
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_lead')
  )
);