
-- -- Restrict Realtime channel subscriptions to authenticated staff for sensitive topics,
-- -- and authenticated users in general for other topics.
-- -- realtime.messages controls who can subscribe to which channel topic.

-- ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- -- Drop any existing permissive policies we own
-- DROP POLICY IF EXISTS "Authenticated can subscribe to realtime" ON realtime.messages;
-- DROP POLICY IF EXISTS "Staff only sensitive realtime topics" ON realtime.messages;
-- DROP POLICY IF EXISTS "Authenticated realtime non-sensitive topics" ON realtime.messages;

-- -- Sensitive topics (engineer GPS / geofence / admin) are limited to admin or team_lead.
-- CREATE POLICY "Staff only sensitive realtime topics"
-- ON realtime.messages
-- FOR SELECT
-- TO authenticated
-- USING (
--   (
--     realtime.topic() LIKE 'engineer_location_history%'
--     OR realtime.topic() LIKE 'geofence_events%'
--     OR realtime.topic() LIKE 'admin%'
--     OR realtime.topic() LIKE 'staff%'
--   )
--   AND (
--     public.has_role(auth.uid(), 'admin')
--     OR public.has_role(auth.uid(), 'team_lead')
--   )
-- );

-- -- All other realtime topics: only authenticated users may subscribe.
-- CREATE POLICY "Authenticated realtime non-sensitive topics"
-- ON realtime.messages
-- FOR SELECT
-- TO authenticated
-- USING (
--   realtime.topic() NOT LIKE 'engineer_location_history%'
--   AND realtime.topic() NOT LIKE 'geofence_events%'
--   AND realtime.topic() NOT LIKE 'admin%'
--   AND realtime.topic() NOT LIKE 'staff%'
-- );
