
ALTER TABLE public.chat_room_messages ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.chat_room_messages ADD COLUMN pinned_by uuid DEFAULT NULL;
ALTER TABLE public.chat_room_messages ADD COLUMN pinned_at timestamp with time zone DEFAULT NULL;

-- Allow room members to update the pin status of messages
CREATE POLICY "Members can pin messages in their rooms"
ON public.chat_room_messages
FOR UPDATE
USING (
  room_id IN (
    SELECT rm.room_id FROM chat_room_members rm WHERE rm.user_id = auth.uid()
  )
)
WITH CHECK (
  room_id IN (
    SELECT rm.room_id FROM chat_room_members rm WHERE rm.user_id = auth.uid()
  )
);
