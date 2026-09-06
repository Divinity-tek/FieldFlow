-- Configurable escalation policy + state
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS escalation_unanswered_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS escalation_max_level         integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS escalation_level             integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at            timestamptz;

CREATE INDEX IF NOT EXISTS idx_tickets_open_chat_escalation
  ON public.tickets(chat_room_id, status)
  WHERE status NOT IN ('resolved','closed') AND chat_room_id IS NOT NULL;

-- Core escalation routine
CREATE OR REPLACE FUNCTION public.escalate_stuck_tickets()
RETURNS TABLE(ticket_id uuid, new_level integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_last RECORD;
  v_minutes int;
  v_should boolean;
  v_reason text;
  v_new_level int;
  v_new_priority text;
  v_old_priority text;
  v_admin RECORD;
BEGIN
  FOR r IN
    SELECT t.id, t.subject, t.priority, t.chat_room_id, t.assigned_to,
           t.escalation_unanswered_minutes, t.escalation_max_level, t.escalation_level,
           t.last_escalated_at, t.status, t.first_response_at,
           t.sla_response_due_at, t.sla_resolution_due_at,
           t.sla_response_breached, t.sla_resolution_breached
      FROM public.tickets t
     WHERE t.status NOT IN ('resolved','closed')
       AND t.chat_room_id IS NOT NULL
  LOOP
    v_minutes := COALESCE(r.escalation_unanswered_minutes, 30);
    v_should  := false;
    v_reason  := NULL;

    -- Cooldown: don't escalate the same ticket twice within the threshold window
    IF r.last_escalated_at IS NOT NULL
       AND r.last_escalated_at > now() - make_interval(mins => v_minutes) THEN
      CONTINUE;
    END IF;

    IF r.escalation_level >= COALESCE(r.escalation_max_level, 3) THEN
      CONTINUE;
    END IF;

    -- Look at the most recent non-system, non-deleted chat message in the ticket room
    SELECT m.created_at, m.sender_id
      INTO v_last
      FROM public.chat_room_messages m
     WHERE m.room_id = r.chat_room_id
       AND m.message_type <> 'system'
       AND NOT m.is_deleted
     ORDER BY m.created_at DESC
     LIMIT 1;

    -- Rule 1: ticket has an assignee and the most recent reply was NOT by the assignee
    --         and it is older than the unanswered threshold.
    IF v_last.created_at IS NOT NULL
       AND r.assigned_to IS NOT NULL
       AND v_last.sender_id IS DISTINCT FROM r.assigned_to
       AND v_last.created_at < now() - make_interval(mins => v_minutes) THEN
      v_should := true;
      v_reason := format('Unanswered chat message for %s minutes',
                         extract(epoch from (now() - v_last.created_at))::int / 60);
    END IF;

    -- Rule 2: SLA breach + no response yet
    IF NOT v_should
       AND r.sla_response_breached
       AND r.first_response_at IS NULL THEN
      v_should := true;
      v_reason := 'SLA response breached without a first response';
    END IF;

    -- Rule 3: SLA resolution breached and still open
    IF NOT v_should AND r.sla_resolution_breached THEN
      v_should := true;
      v_reason := 'SLA resolution breached';
    END IF;

    IF NOT v_should THEN CONTINUE; END IF;

    v_new_level := r.escalation_level + 1;
    v_old_priority := r.priority::text;
    v_new_priority := CASE v_old_priority
      WHEN 'low'    THEN 'medium'
      WHEN 'medium' THEN 'high'
      WHEN 'high'   THEN 'urgent'
      ELSE 'urgent' END;

    UPDATE public.tickets
       SET escalation_level   = v_new_level,
           last_escalated_at  = now(),
           priority           = v_new_priority::job_priority,
           updated_at         = now()
     WHERE id = r.id;

    -- Activity timeline entry
    INSERT INTO public.ticket_activity_log
      (ticket_id, actor_id, action, field, old_value, new_value, note)
    VALUES
      (r.id, NULL, 'ticket_escalated', 'escalation_level',
       (v_new_level - 1)::text, v_new_level::text,
       format('Auto-escalated (L%s): %s. Priority %s → %s.', v_new_level, v_reason, v_old_priority, v_new_priority));

    -- Post system message into the ticket chat room
    INSERT INTO public.chat_room_messages (room_id, sender_id, content, message_type, metadata)
    VALUES (
      r.chat_room_id, NULL,
      format('⚠️ Auto-escalated to L%s — %s. Priority bumped to **%s**.',
             v_new_level, v_reason, v_new_priority),
      'system',
      jsonb_build_object('event','escalation','ticket_id', r.id, 'level', v_new_level)
    );

    -- Notify assignee
    IF r.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, message, type, metadata)
      VALUES (r.assigned_to,
              format('Ticket escalated (L%s)', v_new_level),
              format('"%s": %s', r.subject, v_reason),
              'ticket',
              jsonb_build_object('ticket_id', r.id, 'level', v_new_level));
    END IF;

    -- Notify admins + team leads
    FOR v_admin IN
      SELECT DISTINCT ur.user_id
        FROM public.user_roles ur
       WHERE ur.role IN ('admin','team_lead')
    LOOP
      INSERT INTO public.notifications(user_id, title, message, type, metadata)
      VALUES (v_admin.user_id,
              format('Ticket escalated (L%s)', v_new_level),
              format('"%s": %s', r.subject, v_reason),
              'ticket',
              jsonb_build_object('ticket_id', r.id, 'level', v_new_level, 'reason', v_reason));
    END LOOP;

    ticket_id := r.id; new_level := v_new_level; reason := v_reason;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.escalate_stuck_tickets() FROM PUBLIC, anon, authenticated;