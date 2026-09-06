-- Settings (singleton)
CREATE TABLE public.dispatch_agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  autonomy text NOT NULL DEFAULT 'suggest' CHECK (autonomy IN ('suggest','auto','full')),
  weight_skill numeric NOT NULL DEFAULT 40,
  weight_distance numeric NOT NULL DEFAULT 30,
  weight_rating numeric NOT NULL DEFAULT 20,
  weight_experience numeric NOT NULL DEFAULT 10,
  sla_risk_threshold_minutes integer NOT NULL DEFAULT 30,
  max_auto_assign_radius_km integer NOT NULL DEFAULT 50,
  require_approval_priorities text[] NOT NULL DEFAULT ARRAY['urgent']::text[],
  reassign_scan_enabled boolean NOT NULL DEFAULT true,
  scheduling_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dispatch_agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read settings" ON public.dispatch_agent_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team_lead'::app_role));
CREATE POLICY "Admins manage settings" ON public.dispatch_agent_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.dispatch_agent_settings (id) VALUES (gen_random_uuid());

-- Audit log
CREATE TABLE public.dispatch_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  job_id uuid,
  engineer_id uuid,
  status text NOT NULL DEFAULT 'completed',
  autonomy text,
  score numeric,
  reasoning text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_actions_created ON public.dispatch_agent_actions(created_at DESC);
CREATE INDEX idx_agent_actions_job ON public.dispatch_agent_actions(job_id);
ALTER TABLE public.dispatch_agent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read actions" ON public.dispatch_agent_actions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team_lead'::app_role));
CREATE POLICY "Auth can insert actions" ON public.dispatch_agent_actions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Approvals queue
CREATE TABLE public.dispatch_agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  recommended_engineer_id uuid,
  reason text,
  score numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_approvals_status ON public.dispatch_agent_approvals(status, created_at DESC);
ALTER TABLE public.dispatch_agent_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read approvals" ON public.dispatch_agent_approvals
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team_lead'::app_role));
CREATE POLICY "Staff manage approvals" ON public.dispatch_agent_approvals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team_lead'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team_lead'::app_role));

-- Chat history
CREATE TABLE public.dispatch_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_msgs_user_created ON public.dispatch_agent_messages(user_id, created_at);
ALTER TABLE public.dispatch_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own messages" ON public.dispatch_agent_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.dispatch_agent_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.dispatch_agent_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger for settings
CREATE TRIGGER trg_dispatch_agent_settings_updated
BEFORE UPDATE ON public.dispatch_agent_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();