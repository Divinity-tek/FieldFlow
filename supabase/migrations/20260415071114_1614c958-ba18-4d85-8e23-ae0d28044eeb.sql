
ALTER TABLE public.chat_room_messages 
ADD COLUMN edited_at timestamp with time zone DEFAULT NULL,
ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;

-- Allow senders to delete their own messages
CREATE POLICY "Senders can delete own messages"
ON public.chat_room_messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);
