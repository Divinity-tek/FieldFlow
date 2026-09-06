
CREATE OR REPLACE FUNCTION public.fire_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payload jsonb;
  v_target text;
  v_secret text;
BEGIN
  v_target := COALESCE(
    new.metadata->>'url',
    CASE
      WHEN new.metadata ? 'job_id' THEN '/jobs/' || (new.metadata->>'job_id')
      WHEN new.metadata ? 'ticket_id' THEN '/service-desk/tickets?id=' || (new.metadata->>'ticket_id')
      WHEN new.metadata ? 'chat_room_id' THEN '/internal-chat?room=' || (new.metadata->>'chat_room_id')
      ELSE '/notifications'
    END
  );

  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title', new.title,
    'body', new.message,
    'url', v_target,
    'tag', COALESCE(new.type, 'fieldflow') || ':' || COALESCE(new.metadata->>'job_id', new.metadata->>'ticket_id', new.id::text),
    'notification_id', new.id,
    'type', new.type,
    'role', new.metadata->>'role'
  );

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'push_trigger_secret'
   LIMIT 1;

  PERFORM net.http_post(
    url := 'https://hmefayqwjynhgkiulgmz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Trigger', COALESCE(v_secret, '')
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$function$;
