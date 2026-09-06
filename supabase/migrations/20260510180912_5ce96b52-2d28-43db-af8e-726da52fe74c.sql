-- =========================================================================
-- 1. push_subscriptions table
-- =========================================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id) where is_active = true;
create index push_subscriptions_endpoint_idx on public.push_subscriptions (endpoint);

alter table public.push_subscriptions enable row level security;

-- Users see and manage only their own subscriptions
create policy "Users view own push subscriptions"
on public.push_subscriptions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert own push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users update own push subscriptions"
on public.push_subscriptions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users delete own push subscriptions"
on public.push_subscriptions for delete
to authenticated
using (auth.uid() = user_id);

-- Admins can view all (for support/debugging)
create policy "Admins view all push subscriptions"
on public.push_subscriptions for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create trigger update_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.update_updated_at_column();

-- =========================================================================
-- 2. Trigger: when a new row lands in public.notifications, fire send-push.
--    The existing app already inserts into public.notifications for: job
--    assignment, marketplace updates, ticket assigned/escalated, etc., so
--    pushes piggy-back on that single integration point.
-- =========================================================================

-- pg_net is preinstalled on Supabase. We use it to POST to the edge function
-- asynchronously so the originating transaction never blocks on push delivery.
create extension if not exists pg_net;

create or replace function public.fire_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url text;
  v_anon text;
  v_payload jsonb;
  v_target text;
begin
  -- Build payload
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

  -- Resolve edge function URL + service role at call time. We read these from
  -- a per-DB GUC that the migration script sets below; if missing, we no-op.
  begin
    v_url := current_setting('app.send_push_url', true);
    v_anon := current_setting('app.service_role_key', true);
  exception when others then
    v_url := null;
  end;

  if v_url is null or v_url = '' then
    -- Settings not configured yet — silently skip. Push will resume once
    -- the operator runs the alter database statement below.
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_anon, '')
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Never break the originating transaction because of push delivery problems.
  return new;
end;
$$;

drop trigger if exists notifications_fire_push on public.notifications;
create trigger notifications_fire_push
  after insert on public.notifications
  for each row execute function public.fire_push_for_notification();