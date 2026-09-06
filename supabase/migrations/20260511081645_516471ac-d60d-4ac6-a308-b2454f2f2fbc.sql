ALTER TABLE public.dispatch_agent_settings
  ADD COLUMN IF NOT EXISTS sla_warning_threshold_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sla_breach_threshold_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_required_statuses text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS approval_required_service_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS reassign_on_sla_breach boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_sla_warning boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS escalation_levels jsonb NOT NULL DEFAULT '[
    {"level":1,"after_minutes":15,"action":"notify","notify_roles":["team_lead"]},
    {"level":2,"after_minutes":30,"action":"reassign","notify_roles":["admin","team_lead"]},
    {"level":3,"after_minutes":60,"action":"escalate","notify_roles":["admin"]}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS working_hours_start time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS working_hours_end time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS working_hours_only boolean NOT NULL DEFAULT false;