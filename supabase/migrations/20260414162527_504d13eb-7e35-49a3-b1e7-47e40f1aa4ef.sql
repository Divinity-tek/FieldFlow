
-- Add sharing columns
ALTER TABLE public.chat_conversations
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN share_token TEXT UNIQUE DEFAULT NULL;

-- Allow public read of shared conversations by token
CREATE POLICY "Anyone can view public conversations"
  ON public.chat_conversations FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Allow public read of messages in shared conversations
CREATE POLICY "Anyone can view messages of public conversations"
  ON public.chat_messages FOR SELECT
  TO anon, authenticated
  USING (conversation_id IN (
    SELECT id FROM public.chat_conversations WHERE is_public = true
  ));
