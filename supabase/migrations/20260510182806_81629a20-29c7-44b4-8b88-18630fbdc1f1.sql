-- 1) Remove broad client SELECT on engineers (sensitive PII / GPS / docs).
DROP POLICY IF EXISTS "Clients view engineers assigned to their jobs" ON public.engineers;

-- 2) Remove blanket engineer SELECT on rate cards.
DROP POLICY IF EXISTS "Engineers can view rate cards" ON public.engineer_rate_cards;

-- 3) Tighten pwa_install_events insert: forbid spoofing other users' ids.
DROP POLICY IF EXISTS "Anyone can record install events" ON public.pwa_install_events;
CREATE POLICY "Anyone can record install events"
  ON public.pwa_install_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 4) Generate a shared secret for the push trigger and store in Vault.
DO $$
DECLARE
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM vault.secrets WHERE name = 'push_trigger_secret';
  IF v_existing IS NULL THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'push_trigger_secret',
      'Shared secret used to authenticate pg_net -> send-push edge function calls'
    );
  END IF;
END $$;

-- 5) Update the trigger to send the secret to the edge function.
CREATE OR REPLACE FUNCTION public.fire_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'type', new.type
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
$$;