INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Engineers upload own receipts" ON storage.objects;
CREATE POLICY "Engineers upload own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1 FROM public.engineers e
    WHERE e.user_id = auth.uid() AND e.id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Engineers read own receipts" ON storage.objects;
CREATE POLICY "Engineers read own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'team_lead'::app_role)
    OR has_role(auth.uid(), 'associate_coordinator'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.engineers e
      WHERE e.user_id = auth.uid() AND e.id::text = (storage.foldername(name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Engineers delete own receipts" ON storage.objects;
CREATE POLICY "Engineers delete own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.engineers e
      WHERE e.user_id = auth.uid() AND e.id::text = (storage.foldername(name))[1]
    )
  )
);