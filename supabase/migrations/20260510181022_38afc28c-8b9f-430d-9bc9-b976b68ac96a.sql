create or replace function public.fire_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_payload jsonb;
  v_target text;
begin
  v_target := coalesce(
    new.metadata->>'url',
    case
      when new.metadata ? 'job_id' then '/jobs/' || (new.metadata->>'job_id')
      when new.metadata ? 'ticket_id' then '/service-desk/tickets?id=' || (new.metadata->>'ticket_id')
      when new.metadata ? 'chat_room_id' then '/internal-chat?room=' || (new.metadata->>'chat_room_id')
      else '/notifications'
    end
  );

  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title', new.title,
    'body', new.message,
    'url', v_target,
    'tag', coalesce(new.type, 'fieldflow') || ':' || coalesce(new.metadata->>'job_id', new.metadata->>'ticket_id', new.id::text),
    'notification_id', new.id,
    'type', new.type
  );

  perform net.http_post(
    url := 'https://hmefayqwjynhgkiulgmz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Trigger', 'fieldflow-notifications'
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end;
$$;