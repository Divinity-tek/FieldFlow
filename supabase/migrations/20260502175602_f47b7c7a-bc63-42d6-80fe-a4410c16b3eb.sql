
REVOKE EXECUTE ON FUNCTION public.is_client_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_client_member(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.client_portal_role_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_portal_role_of(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated read portal-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload portal-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own portal-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own portal-attachments" ON storage.objects;

CREATE POLICY "Portal attachments: client/admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'portal-attachments' AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'team_lead')
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_client_member(((storage.foldername(name))[1])::uuid, auth.uid())
      )
    )
  );

CREATE POLICY "Portal attachments: client/admin upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-attachments' AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'team_lead')
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_client_member(((storage.foldername(name))[1])::uuid, auth.uid())
      )
    )
  );

CREATE POLICY "Portal attachments: owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portal-attachments' AND owner = auth.uid());

CREATE POLICY "Portal attachments: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portal-attachments' AND owner = auth.uid());
