INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Client logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-logos');

CREATE POLICY "Admins and team leads can upload client logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
);

CREATE POLICY "Admins and team leads can update client logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'client-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
);

CREATE POLICY "Admins and team leads can delete client logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-logos'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_lead'))
);