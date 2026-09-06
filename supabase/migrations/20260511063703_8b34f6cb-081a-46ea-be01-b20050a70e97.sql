
-- Enable extensions for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable realtime for agent tables and jobs so the UI gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_agent_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_agent_approvals;

-- Capture full row data on updates
ALTER TABLE public.dispatch_agent_actions REPLICA IDENTITY FULL;
ALTER TABLE public.dispatch_agent_approvals REPLICA IDENTITY FULL;
