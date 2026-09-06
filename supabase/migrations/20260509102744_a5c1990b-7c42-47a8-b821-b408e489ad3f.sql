
CREATE OR REPLACE FUNCTION public.get_ticket_unread_counts()
RETURNS TABLE(ticket_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id AS ticket_id,
         COUNT(m.id) AS unread_count
    FROM public.tickets t
    JOIN public.chat_room_members crm
      ON crm.room_id = t.chat_room_id
     AND crm.user_id = auth.uid()
    LEFT JOIN public.chat_room_messages m
      ON m.room_id = t.chat_room_id
     AND m.sender_id <> auth.uid()
     AND COALESCE(m.is_deleted, false) = false
     AND COALESCE(m.message_type, 'text') <> 'system'
     AND (crm.last_read_at IS NULL OR m.created_at > crm.last_read_at)
   WHERE t.chat_room_id IS NOT NULL
     AND auth.uid() IS NOT NULL
   GROUP BY t.id;
$$;
