-- 1) Idempotency column
ALTER TABLE public.ticket_activity_log
  ADD COLUMN IF NOT EXISTS source_message_id uuid;

-- Add a real (non-partial) unique constraint so we can use ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_ticket_activity_source_message'
  ) THEN
    ALTER TABLE public.ticket_activity_log
      ADD CONSTRAINT uq_ticket_activity_source_message UNIQUE (source_message_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ticket_activity_source_message
  ON public.ticket_activity_log(source_message_id);

-- 2) Replace sync function with INSERT/UPDATE/DELETE handling
CREATE OR REPLACE FUNCTION public.chat_msg_to_ticket_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
  v_room_type text;
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

  IF TG_OP = 'INSERT' THEN
    IF NEW.message_type = 'system' OR NEW.is_deleted THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.ticket_activity_log
      (ticket_id, actor_id, action, note, source_message_id, created_at)
    VALUES
      (v_ticket_id, NEW.sender_id, 'chat_reply', left(NEW.content, 4000), NEW.id, NEW.created_at)
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
    IF NEW.content IS DISTINCT FROM OLD.content AND NOT NEW.is_deleted THEN
      UPDATE public.ticket_activity_log
         SET action = 'chat_reply_edited',
             old_value = left(OLD.content, 2000),
             new_value = left(NEW.content, 2000),
             note      = left(NEW.content, 4000)
       WHERE source_message_id = NEW.id;
      IF NOT FOUND AND NEW.message_type <> 'system' THEN
        INSERT INTO public.ticket_activity_log
          (ticket_id, actor_id, action, note, source_message_id, created_at)
        VALUES
          (v_ticket_id, NEW.sender_id, 'chat_reply_edited', left(NEW.content, 4000), NEW.id, now())
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

-- 3) Re-attach triggers
DROP TRIGGER IF EXISTS trg_chat_msg_to_ticket_log ON public.chat_room_messages;
CREATE TRIGGER trg_chat_msg_to_ticket_log
AFTER INSERT OR UPDATE OR DELETE ON public.chat_room_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_msg_to_ticket_log();

-- 4) Backfill missed messages
INSERT INTO public.ticket_activity_log
  (ticket_id, actor_id, action, note, source_message_id, created_at)
SELECT t.id, m.sender_id, 'chat_reply', left(m.content, 4000), m.id, m.created_at
  FROM public.chat_room_messages m
  JOIN public.chat_rooms r ON r.id = m.room_id AND r.type = 'ticket'
  JOIN public.tickets t    ON t.chat_room_id = m.room_id
 WHERE m.message_type <> 'system'
   AND NOT m.is_deleted
ON CONFLICT (source_message_id) DO NOTHING;

-- 5) Realtime
ALTER TABLE public.ticket_activity_log REPLICA IDENTITY FULL;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_activity_log';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;