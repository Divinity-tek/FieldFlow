
ALTER TABLE public.service_desk_teams
  ADD COLUMN IF NOT EXISTS chat_room_id uuid REFERENCES public.chat_rooms(id) ON DELETE SET NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS chat_room_id uuid REFERENCES public.chat_rooms(id) ON DELETE SET NULL;

-- Internal chat ticket bridge: posts ticket events into ticket room
CREATE OR REPLACE FUNCTION public.tickets_post_to_internal_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_team_room uuid;
  v_actor uuid := auth.uid();
  v_msg text;
  v_assignee_name text;
  v_old_assignee_name text;
  v_routed_team uuid;
BEGIN
  -- Resolve team room (if ticket has a routed team via teams_inquiries OR by category/location)
  IF TG_OP = 'INSERT' THEN
    -- Create dedicated ticket room
    INSERT INTO public.chat_rooms(name, type, status, created_by)
    VALUES ('Ticket: ' || left(NEW.subject, 80), 'ticket', 'active', COALESCE(v_actor, NEW.assigned_to))
    RETURNING id INTO v_room_id;

    NEW.chat_room_id := v_room_id;

    -- Add creator + assignee as members
    IF v_actor IS NOT NULL THEN
      INSERT INTO public.chat_room_members(room_id, user_id, role)
      VALUES (v_room_id, v_actor, 'owner') ON CONFLICT DO NOTHING;
    END IF;
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.chat_room_members(room_id, user_id, role)
      VALUES (v_room_id, NEW.assigned_to, 'member') ON CONFLICT DO NOTHING;
    END IF;

    -- Pull team members (if routed)
    SELECT t.chat_room_id INTO v_team_room
      FROM public.service_desk_teams t
      JOIN public.teams_inquiries ti ON ti.routed_team_id = t.id
     WHERE ti.ticket_id = NEW.id
     LIMIT 1;
    IF v_team_room IS NOT NULL THEN
      INSERT INTO public.chat_room_members(room_id, user_id, role)
      SELECT v_room_id, m.user_id, 'member'
        FROM public.chat_room_members m
       WHERE m.room_id = v_team_room
      ON CONFLICT DO NOTHING;
    END IF;

    -- Post creation message in ticket room
    INSERT INTO public.chat_room_messages(room_id, sender_id, content, message_type, metadata)
    VALUES (
      v_room_id, v_actor,
      format('🎫 Ticket opened: **%s** (priority: %s)', NEW.subject, NEW.priority),
      'system',
      jsonb_build_object('ticket_id', NEW.id, 'event', 'created')
    );

    -- Mirror into team room if mapped
    IF v_team_room IS NOT NULL THEN
      INSERT INTO public.chat_room_messages(room_id, sender_id, content, message_type, metadata)
      VALUES (
        v_team_room, v_actor,
        format('🎫 New ticket routed: **%s** (priority: %s)', NEW.subject, NEW.priority),
        'system',
        jsonb_build_object('ticket_id', NEW.id, 'event', 'created', 'ticket_room_id', v_room_id)
      );
    END IF;

    -- Notify assignee
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, message, type, metadata)
      VALUES (NEW.assigned_to, 'New ticket assigned',
              format('You were assigned to "%s"', NEW.subject), 'ticket',
              jsonb_build_object('ticket_id', NEW.id, 'chat_room_id', v_room_id));
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  v_room_id := NEW.chat_room_id;
  IF v_room_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    SELECT full_name INTO v_assignee_name FROM public.profiles WHERE user_id = NEW.assigned_to;
    -- Add new assignee to room
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.chat_room_members(room_id, user_id, role)
      VALUES (v_room_id, NEW.assigned_to, 'member') ON CONFLICT DO NOTHING;
      INSERT INTO public.notifications(user_id, title, message, type, metadata)
      VALUES (NEW.assigned_to, 'Ticket assigned to you',
              format('You were assigned to "%s"', NEW.subject), 'ticket',
              jsonb_build_object('ticket_id', NEW.id, 'chat_room_id', v_room_id));
    END IF;
    INSERT INTO public.chat_room_messages(room_id, sender_id, content, message_type, metadata)
    VALUES (v_room_id, v_actor,
            format('👤 Assigned to %s', COALESCE(v_assignee_name, 'unassigned')),
            'system',
            jsonb_build_object('ticket_id', NEW.id, 'event', 'assigned'));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.chat_room_messages(room_id, sender_id, content, message_type, metadata)
    VALUES (v_room_id, v_actor,
            format('🔄 Status: %s → **%s**', OLD.status, NEW.status),
            'system',
            jsonb_build_object('ticket_id', NEW.id, 'event', 'status_changed'));
    -- DM assignee on resolved/closed too
    IF NEW.assigned_to IS NOT NULL AND NEW.status::text IN ('resolved','closed','in_progress') THEN
      INSERT INTO public.notifications(user_id, title, message, type, metadata)
      VALUES (NEW.assigned_to,
              format('Ticket %s', NEW.status),
              format('"%s" is now %s', NEW.subject, NEW.status),
              'ticket',
              jsonb_build_object('ticket_id', NEW.id, 'chat_room_id', v_room_id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_post_chat ON public.tickets;
CREATE TRIGGER trg_tickets_post_chat
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tickets_post_to_internal_chat();

-- Note: AFTER trigger can't change NEW. Switch to BEFORE for INSERT to set chat_room_id.
DROP TRIGGER IF EXISTS trg_tickets_post_chat ON public.tickets;
CREATE TRIGGER trg_tickets_post_chat_before
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tickets_post_to_internal_chat();

CREATE TRIGGER trg_tickets_post_chat_after
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tickets_post_to_internal_chat();

-- Two-way: mirror chat replies into ticket activity log
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
  IF NEW.message_type = 'system' THEN RETURN NEW; END IF;

  SELECT r.type INTO v_room_type FROM public.chat_rooms r WHERE r.id = NEW.room_id;
  IF v_room_type <> 'ticket' THEN RETURN NEW; END IF;

  SELECT id INTO v_ticket_id FROM public.tickets WHERE chat_room_id = NEW.room_id LIMIT 1;
  IF v_ticket_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.ticket_activity_log(ticket_id, actor_id, action, note)
  VALUES (v_ticket_id, NEW.sender_id, 'chat_reply', left(NEW.content, 2000));

  -- First response timestamp
  UPDATE public.tickets
     SET first_response_at = COALESCE(first_response_at, NEW.created_at)
   WHERE id = v_ticket_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_msg_to_ticket_log ON public.chat_room_messages;
CREATE TRIGGER trg_chat_msg_to_ticket_log
AFTER INSERT ON public.chat_room_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_msg_to_ticket_log();
