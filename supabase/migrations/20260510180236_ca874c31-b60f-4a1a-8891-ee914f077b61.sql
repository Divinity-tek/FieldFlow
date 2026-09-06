create table public.pwa_install_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('impression','accept','dismiss','ios_hint_shown','installed')),
  platform text not null check (platform in ('android','ios','desktop','other')),
  session_id text not null,
  user_agent text,
  user_id uuid,
  created_at timestamp with time zone not null default now()
);

create index pwa_install_events_created_at_idx on public.pwa_install_events (created_at desc);
create index pwa_install_events_event_type_idx on public.pwa_install_events (event_type);
create index pwa_install_events_platform_idx on public.pwa_install_events (platform);

alter table public.pwa_install_events enable row level security;

-- Anyone (anon + authenticated) can insert events. Needed because the
-- install prompt appears on the public landing page before login.
create policy "Anyone can record install events"
on public.pwa_install_events
for insert
to anon, authenticated
with check (true);

-- Only admins can read events.
create policy "Admins can view install events"
on public.pwa_install_events
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));