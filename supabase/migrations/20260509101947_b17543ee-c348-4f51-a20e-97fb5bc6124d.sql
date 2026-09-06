
-- 1. Failure log table
CREATE TABLE IF NOT EXISTS public.chat_sync_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID,
  message_id UUID,
  ticket_id UUID,
  op TEXT NOT NULL,
  error TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sync_failures_status ON public.chat_sync_failures(status, last_attempt_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sync_failures_msg ON public.chat_sync_failures(message_id);

ALTER TABLE public.chat_sync_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view chat sync failures" ON public.chat_sync_failures;
CREATE POLICY "Admins can view chat sync failures"
  ON public.chat_sync_failures
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update chat sync failures" ON public.chat_sync_failures;
CREATE POLICY "Admins can update chat sync failures"
  ON public.chat_sync_failures
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_chat_sync_failures_updated_at ON public.chat_sync_failures;
CREATE TRIGGER trg_chat_sync_failures_updated_at
  BEFORE UPDATE ON public.chat_sync_failures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Wrap the trigger logic in an inner SECURITY DEFINER routine we can also call from retry
CREATE OR REPLACE FUNCTION public.sync_chat_message_to_ticket_log(
  p_op TEXT,
  p_new_id UUID,
  p_old_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_new public.chat_room_messages%ROWTYPE;
  m_old public.chat_room_messages%ROWTYPE;
  v_ticket_id uuid;
  v_room_type text;
  v_atts jsonb;
  v_att_text text;
  v_note text;
  v_room_id uuid;
  v_msg_type text;
  v_is_deleted boolean;
  v_content text;
  v_metadata jsonb;
  v_sender_id uuid;
  v_msg_created_at timestamptz;
BEGIN
  IF p_new_id IS NOT NULL THEN
    SELECT * INTO m_new FROM public.chat_room_messages WHERE id = p_new_id;
  END IF;
  IF p_old_id IS NOT NULL THEN
    SELECT * INTO m_old FROM public.chat_room_messages WHERE id = p_old_id;
  END IF;

  v_room_id := COALESCE(m_new.room_id, m_old.room_id);
  v_msg_type := COALESCE(m_new.message_type, m_old.message_type);
  v_is_deleted := COALESCE(m_new.is_deleted, m_old.is_deleted);
  v_content := COALESCE(m_new.content, m_old.content);
  v_metadata := COALESCE(m_new.metadata, m_old.metadata);
  v_sender_id := COALESCE(m_new.sender_id, m_old.sender_id);
  v_msg_created_at := COALESCE(m_new.created_at, m_old.created_at);

  SELECT r.type INTO v_room_type FROM public.chat_rooms r WHERE r.id = v_room_id;
  IF v_room_type IS DISTINCT FROM 'ticket' THEN RETURN; END IF;

  SELECT t.id INTO v_ticket_id FROM public.tickets t WHERE t.chat_room_id = v_room_id LIMIT 1;
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'No ticket linked to chat_room %', v_room_id;
  END IF;

  v_atts := COALESCE(v_metadata->'attachments', '[]'::jsonb);
  IF jsonb_array_length(v_atts) > 0 THEN
    SELECT string_agg(format('[%s] %s', COALESCE(a->>'type',''), COALESCE(a->>'url','')), E'\n')
      INTO v_att_text FROM jsonb_array_elements(v_atts) AS a;
    v_note := left(COALESCE(v_content,'') || E'\n📎 Attachments:\n' || v_att_text, 6000);
  ELSE
    v_note := left(COALESCE(v_content,''), 6000);
  END IF;

  IF p_op = 'INSERT' THEN
    IF v_msg_type = 'system' OR v_is_deleted THEN RETURN; END IF;
    INSERT INTO public.ticket_activity_log
      (ticket_id, actor_id, action, note, source_message_id, created_at)
    VALUES
      (v_ticket_id, v_sender_id, 'chat_reply', v_note, p_new_id, v_msg_created_at)
    ON CONFLICT (source_message_id) DO UPDATE
      SET action = 'chat_reply', note = EXCLUDED.note;
    UPDATE public.tickets
       SET first_response_at = COALESCE(first_response_at, v_msg_created_at),
           updated_at = now()
     WHERE id = v_ticket_id;
  ELSIF p_op = 'UPDATE' THEN
    IF v_is_deleted AND NOT COALESCE(m_old.is_deleted,false) THEN
      UPDATE public.ticket_activity_log
         SET action = 'chat_reply_deleted', note = '[message deleted]'
       WHERE source_message_id = p_new_id;
      RETURN;
    END IF;
    UPDATE public.ticket_activity_log
       SET action = CASE WHEN m_new.content IS DISTINCT FROM m_old.content
                         THEN 'chat_reply_edited' ELSE action END,
           old_value = left(m_old.content, 2000),
           new_value = left(m_new.content, 2000),
           note = v_note
     WHERE source_message_id = p_new_id;
    IF NOT FOUND AND v_msg_type <> 'system' AND NOT v_is_deleted THEN
      INSERT INTO public.ticket_activity_log
        (ticket_id, actor_id, action, note, source_message_id, created_at)
      VALUES (v_ticket_id, v_sender_id, 'chat_reply_edited', v_note, p_new_id, now())
      ON CONFLICT (source_message_id) DO NOTHING;
    END IF;
  ELSIF p_op = 'DELETE' THEN
    UPDATE public.ticket_activity_log
       SET action = 'chat_reply_deleted', note = '[message removed]'
     WHERE source_message_id = p_old_id;
  END IF;
END;
$$;

-- 3. Replace trigger function with safe version that records failures
CREATE OR REPLACE FUNCTION public.chat_msg_to_ticket_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_ticket_id uuid;
  v_msg_id uuid;
  v_err text;
BEGIN
  v_room_id := COALESCE(NEW.room_id, OLD.room_id);
  v_msg_id := COALESCE(NEW.id, OLD.id);

  BEGIN
    PERFORM public.sync_chat_message_to_ticket_log(TG_OP, NEW.id, OLD.id);

    -- If a previous failure existed and now succeeded, mark resolved
    UPDATE public.chat_sync_failures
       SET status = 'resolved', resolved_at = now(), updated_at = now()
     WHERE message_id = v_msg_id AND status = 'pending';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    SELECT t.id INTO v_ticket_id FROM public.tickets t WHERE t.chat_room_id = v_room_id LIMIT 1;
    INSERT INTO public.chat_sync_failures
      (room_id, message_id, ticket_id, op, error, attempts, status, last_attempt_at)
    VALUES (v_room_id, v_msg_id, v_ticket_id, TG_OP, v_err, 1, 'pending', now())
    ON CONFLICT DO NOTHING;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Retry RPC for admins
CREATE OR REPLACE FUNCTION public.retry_chat_sync(p_failure_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.chat_sync_failures%ROWTYPE;
  v_err text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can retry chat sync';
  END IF;

  SELECT * INTO f FROM public.chat_sync_failures WHERE id = p_failure_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Failure not found'; END IF;

  BEGIN
    PERFORM public.sync_chat_message_to_ticket_log(
      f.op,
      CASE WHEN f.op IN ('INSERT','UPDATE') THEN f.message_id ELSE NULL END,
      CASE WHEN f.op IN ('UPDATE','DELETE') THEN f.message_id ELSE NULL END
    );
    UPDATE public.chat_sync_failures
       SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid(),
           attempts = attempts + 1, last_attempt_at = now(), updated_at = now()
     WHERE id = p_failure_id;
    RETURN jsonb_build_object('ok', true);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    UPDATE public.chat_sync_failures
       SET attempts = attempts + 1, last_attempt_at = now(), error = v_err, updated_at = now()
     WHERE id = p_failure_id;
    RETURN jsonb_build_object('ok', false, 'error', v_err);
  END;
END;
$$;

-- 5. Resolve / ignore RPC
CREATE OR REPLACE FUNCTION public.resolve_chat_sync_failure(p_failure_id UUID, p_status TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can resolve chat sync failures';
  END IF;
  IF p_status NOT IN ('resolved','ignored','pending') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;
  UPDATE public.chat_sync_failures
     SET status = p_status,
         resolved_at = CASE WHEN p_status IN ('resolved','ignored') THEN now() ELSE NULL END,
         resolved_by = CASE WHEN p_status IN ('resolved','ignored') THEN auth.uid() ELSE NULL END,
         updated_at = now()
   WHERE id = p_failure_id;
END;
$$;
