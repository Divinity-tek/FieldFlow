-- Make chat-attachments bucket public so previews render
UPDATE storage.buckets
   SET public = true,
       file_size_limit = 52428800, -- 50MB
       allowed_mime_types = ARRAY[
         'image/png','image/jpeg','image/jpg','image/gif','image/webp','image/heic',
         'video/mp4','video/quicktime','video/webm','video/x-matroska','video/x-msvideo',
         'application/pdf','text/plain','text/csv',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
       ]
 WHERE id = 'chat-attachments';

-- Public read policy for chat-attachments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Chat attachments are public'
  ) THEN
    CREATE POLICY "Chat attachments are public"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'chat-attachments');
  END IF;
END $$;

-- Update chat → ticket sync to include attachment links
CREATE OR REPLACE FUNCTION public.chat_msg_to_ticket_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
  v_room_type text;
  v_atts jsonb;
  v_att_text text;
  v_note text;
BEGIN
  SELECT r.type INTO v_room_type
    FROM public.chat_rooms r
   WHERE r.id = COALESCE(NEW.room_id, OLD.room_id);
  IF v_room_type IS DISTINCT FROM 'ticket' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT t.id INTO v_ticket_id
    FROM public.tickets t
   WHERE t.chat_room_id = COALESCE(NEW.room_id, OLD.room_id)
   LIMIT 1;
  IF v_ticket_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Build a textual note that includes attachment links
  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_atts := COALESCE(NEW.metadata->'attachments', '[]'::jsonb);
    IF jsonb_array_length(v_atts) > 0 THEN
      SELECT string_agg(
               format('[%s] %s',
                      COALESCE(a->>'type',''),
                      COALESCE(a->>'url','')),
               E'\n')
        INTO v_att_text
        FROM jsonb_array_elements(v_atts) AS a;
      v_note := left(COALESCE(NEW.content,'') || E'\n📎 Attachments:\n' || v_att_text, 6000);
    ELSE
      v_note := left(COALESCE(NEW.content,''), 6000);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.message_type = 'system' OR NEW.is_deleted THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.ticket_activity_log
      (ticket_id, actor_id, action, note, source_message_id, created_at)
    VALUES
      (v_ticket_id, NEW.sender_id, 'chat_reply', v_note, NEW.id, NEW.created_at)
    ON CONFLICT (source_message_id) DO NOTHING;

    UPDATE public.tickets
       SET first_response_at = COALESCE(first_response_at, NEW.created_at),
           updated_at = now()
     WHERE id = v_ticket_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_deleted AND NOT OLD.is_deleted THEN
      UPDATE public.ticket_activity_log
         SET action = 'chat_reply_deleted',
             note   = '[message deleted]'
       WHERE source_message_id = NEW.id;
      RETURN NEW;
    END IF;
    IF (NEW.content IS DISTINCT FROM OLD.content
        OR NEW.metadata IS DISTINCT FROM OLD.metadata)
       AND NOT NEW.is_deleted THEN
      UPDATE public.ticket_activity_log
         SET action = CASE WHEN NEW.content IS DISTINCT FROM OLD.content
                           THEN 'chat_reply_edited' ELSE action END,
             old_value = left(OLD.content, 2000),
             new_value = left(NEW.content, 2000),
             note      = v_note
       WHERE source_message_id = NEW.id;
      IF NOT FOUND AND NEW.message_type <> 'system' THEN
        INSERT INTO public.ticket_activity_log
          (ticket_id, actor_id, action, note, source_message_id, created_at)
        VALUES
          (v_ticket_id, NEW.sender_id, 'chat_reply_edited', v_note, NEW.id, now())
        ON CONFLICT (source_message_id) DO NOTHING;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.ticket_activity_log
       SET action = 'chat_reply_deleted',
           note   = '[message removed]'
     WHERE source_message_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;