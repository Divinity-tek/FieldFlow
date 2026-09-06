
ALTER TABLE public.chat_room_messages ADD COLUMN reply_to_id uuid DEFAULT NULL REFERENCES public.chat_room_messages(id) ON DELETE SET NULL;
CREATE INDEX idx_chat_room_messages_reply_to ON public.chat_room_messages(reply_to_id);
