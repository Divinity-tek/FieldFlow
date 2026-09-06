
-- 1) Chat attachments: make bucket private + drop public SELECT policy
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';
DROP POLICY IF EXISTS "Chat attachments are public" ON storage.objects;

-- 2) Realtime: tighten broad authenticated topic policy with scoped per-topic rules
DO $$
BEGIN
  -- Drop the overly permissive policy if it exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='Authenticated realtime non-sensitive topics') THEN
    EXECUTE 'DROP POLICY "Authenticated realtime non-sensitive topics" ON realtime.messages';
  END IF;
END $$;

-- Allow authenticated users to subscribe only to their own scoped topics:
--   notifications:{auth.uid()}, presence:*, presence_v2:*, typing:*, chat_room:*
CREATE POLICY "Authenticated scoped realtime topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() = 'notifications:' || auth.uid()::text
    OR realtime.topic() LIKE 'presence:%'
    OR realtime.topic() LIKE 'presence_v2:%'
    OR realtime.topic() LIKE 'typing:%'
    OR realtime.topic() LIKE 'chat_room:%'
  );
