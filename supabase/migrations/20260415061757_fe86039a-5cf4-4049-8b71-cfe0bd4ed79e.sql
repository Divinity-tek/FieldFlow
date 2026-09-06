
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.chat_room_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  message_id IN (
    SELECT crm.id FROM public.chat_room_messages crm
    WHERE crm.room_id IN (
      SELECT rm.room_id FROM public.chat_room_members rm
      WHERE rm.user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can add own reactions"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
ON public.message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
